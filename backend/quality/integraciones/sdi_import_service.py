
from datetime import date  # Permite convertir la fecha extraída del PDF.
from django.core.exceptions import ValidationError  # Gestiona errores de validación.
from django.db import IntegrityError, transaction  # Garantiza operaciones seguras.
from quality.models import SDI  # Consulta las solicitudes existentes.
from quality.services import crear_sdi, crear_item_sdi  # Reutiliza la lógica validada.
from .sdi_pdf_parser import procesar_pdf_sdi  # Extrae los datos del FR-OPE-133.

DEPARTAMENTOS_VALIDOS = {"Calidad", "Producción", "Bodega"}

def importar_sdi_desde_pdf(contenido_pdf, usuario_actual, departamento_solicitante, solicitante):
    """Importa una SDI y sus productos sin modificar las solicitudes existentes."""

    # 1. Validar el origen y la identidad del solicitante.
    if departamento_solicitante not in DEPARTAMENTOS_VALIDOS:
        raise ValidationError("El departamento solicitante no está autorizado.")
    if not isinstance(solicitante, str) or not solicitante.strip():
        raise ValidationError("Debe indicar el solicitante.")
    if len(solicitante.strip()) > 150:
        raise ValidationError("El nombre del solicitante supera 150 caracteres.")

    # 2. Verificar que se recibió un documento PDF.
    if not isinstance(contenido_pdf, bytes) or not contenido_pdf.startswith(b"%PDF-"):
        raise ValidationError("Debe proporcionar un PDF válido.")

    # 3. Extraer la información utilizando el parser existente.
    try:
        datos = procesar_pdf_sdi(contenido_pdf)
        generales = datos["datos_generales"]
        articulos = datos["articulos"]
        fecha_emision = date.fromisoformat(generales["fecha_emision"])
    except (ValueError, KeyError, TypeError) as error:
        raise ValidationError(f"No fue posible interpretar la SDI: {error}") from error

    # 4. Impedir solicitudes sin productos.
    if not articulos:
        raise ValidationError("La SDI no contiene productos para inspeccionar.")

    # 5. Identificar la SDI por los mismos campos únicos del modelo.
    identificador = {
        "prefijo_bod": generales["prefijo_bod"],
        "activacion_proyecto": generales["activacion_proyecto"],
        "numero_sdi": generales["numero_sdi"],
    }

    # 6. Registrar la SDI y todos sus productos en una sola transacción.
    try:
        with transaction.atomic():
            if SDI.objects.filter(**identificador).exists():
                raise ValidationError("La SDI ya está registrada en el sistema.")

            # 7. Crear la solicitud pendiente y sin inspector.
            sdi = crear_sdi(
                usuario_actual=usuario_actual,
                fecha_emision=fecha_emision,
                proyecto=generales["proyecto"],
                departamento_solicitante=departamento_solicitante,
                solicitante=solicitante.strip(),
                **identificador,
            )
            sdi.full_clean()  # Validar los campos antes de confirmar la importación.

            # 8. Registrar cada producto con su cantidad individual.
            for articulo in articulos:
                item = crear_item_sdi(
                    usuario_actual=usuario_actual,
                    sdi_id=sdi.pk,
                    orden=articulo["orden"],
                    codigo_plano=articulo["codigo_plano"],
                    articulo=articulo["articulo"],
                    cantidad_a_inspeccionar=articulo["cantidad_a_inspeccionar"],
                    observaciones=articulo.get("observaciones", ""),
                )
                item.full_clean()  # Validar el producto registrado.

            # 9. Comprobar que la SDI permanece pendiente y sin inspector.
            sdi.refresh_from_db()
            if sdi.estado != SDI.Estado.PENDIENTE or sdi.inspector_id is not None:
                raise ValidationError("La SDI importada no conservó su estado inicial.")

            return sdi

    except IntegrityError as error:
        # 10. Proteger también contra duplicados detectados por PostgreSQL.
        raise ValidationError(
            "No fue posible registrar la SDI. Comprueba si ya existe."
        ) from error
