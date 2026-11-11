
import hashlib  # Calcula la huella digital del documento PDF.

from django.core.exceptions import ValidationError  # Valida los datos recibidos.
from django.db import transaction  # Evita guardar importaciones incompletas.

from quality.models import RecepcionOutlookSDI  # Historial de recepción Outlook.
from quality.integraciones.sdi_import_service import importar_sdi_desde_pdf  # Importador existente.


def procesar_pdf_recibido(
    contenido_pdf,
    buzon,
    mensaje_id,
    nombre_archivo,
    usuario_actual,
    departamento_solicitante,
    solicitante,
):
    """Importa un PDF autorizado y registra su recepción sin duplicar documentos."""

    # Validar los datos antes de consultar o modificar PostgreSQL.
    if not isinstance(contenido_pdf, bytes) or not contenido_pdf.startswith(b"%PDF-"):
        raise ValidationError("El adjunto no contiene un PDF válido.")

    if not isinstance(buzon, str) or not buzon.strip():
        raise ValidationError("El buzón de Outlook es obligatorio.")

    if not isinstance(mensaje_id, str) or not mensaje_id.strip():
        raise ValidationError("El identificador del mensaje es obligatorio.")

    if not isinstance(nombre_archivo, str) or not nombre_archivo.lower().endswith(".pdf"):
        raise ValidationError("El archivo debe tener extensión PDF.")

    buzon = buzon.strip().lower()
    mensaje_id = mensaje_id.strip()
    nombre_archivo = nombre_archivo.strip()

    if len(buzon) > 254 or len(mensaje_id) > 512 or len(nombre_archivo) > 255:
        raise ValidationError("Los datos de identificación superan la longitud permitida.")

    # La autorización del remitente se comprobará antes de llamar a esta función.
    # El departamento y el solicitante deben provenir de datos previamente validados.
    hash_pdf = hashlib.sha256(contenido_pdf).hexdigest()

    # La importación y el historial se guardan en una sola transacción.
    with transaction.atomic():
        recepcion_existente = RecepcionOutlookSDI.objects.filter(
            buzon=buzon,
            mensaje_id=mensaje_id,
            sha256_pdf=hash_pdf,
        ).first()

        if recepcion_existente is not None:
            return {
                "estado": "duplicado",
                "recepcion_id": recepcion_existente.pk,
                "sdi_id": recepcion_existente.sdi_id,
            }

        # Reutilizar el servicio validado; no duplicar sus reglas de negocio.
        sdi = importar_sdi_desde_pdf(
            contenido_pdf=contenido_pdf,
            usuario_actual=usuario_actual,
            departamento_solicitante=departamento_solicitante,
            solicitante=solicitante,
        )

        # Registrar la recepción únicamente si la SDI se importó correctamente.
        recepcion = RecepcionOutlookSDI.objects.create(
            buzon=buzon,
            mensaje_id=mensaje_id,
            nombre_archivo=nombre_archivo,
            sha256_pdf=hash_pdf,
            sdi=sdi,
            estado=RecepcionOutlookSDI.Estado.PROCESADO,
        )

        return {
            "estado": "procesado",
            "recepcion_id": recepcion.pk,
            "sdi_id": sdi.pk,
        }
