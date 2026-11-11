import hashlib  # Calcula el identificador SHA-256 del PDF.

from django.conf import settings  # Consulta la configuración de Outlook.
from django.contrib.auth import get_user_model  # Obtiene el modelo de usuarios.
from django.core.exceptions import PermissionDenied, ValidationError  # Errores de seguridad y validación.
from django.db import transaction  # Protege las operaciones en PostgreSQL.

from quality.models import PerfilUsuario, RecepcionOutlookSDI  # Modelos existentes.
from quality.permissions import validar_rol  # Reutiliza los permisos del sistema.
from quality.integraciones.sdi_import_service import importar_sdi_desde_pdf  # Importador existente.
from quality.integraciones.outlook_service import (
    obtener_adjuntos_outlook,  # Obtiene los adjuntos mediante Microsoft Graph.
    extraer_pdfs_adjuntos,     # Extrae los PDF y su contenido.
)
def procesar_mensaje_outlook(mensaje, ejecutar_importacion=False):
    """Valida un mensaje y coordina la importación de sus PDF adjuntos."""

    # 1. Bloquear cualquier importación real hasta habilitarla explícitamente.
    if not ejecutar_importacion:
        raise ValidationError("La importación desde Outlook está desactivada.")

    # 2. Verificar el remitente antes de consultar los archivos adjuntos.
    departamento = identificar_departamento_remitente(mensaje)

    # 3. Validar la cuenta técnica mediante los permisos existentes.
    usuario_servicio = obtener_usuario_servicio_outlook()

    # 4. Comprobar el identificador del mensaje.
    mensaje_id = mensaje.get("id")
    if not isinstance(mensaje_id, str) or not mensaje_id.strip():
        raise ValidationError("El mensaje de Outlook no tiene un identificador válido.")

    # 5. Obtener el correo del solicitante ya autorizado.
    solicitante = mensaje["from"]["emailAddress"]["address"].strip().lower()

    # 6. Consultar los adjuntos solamente después de validar la autorización.
    adjuntos = obtener_adjuntos_outlook(mensaje_id)
    documentos = extraer_pdfs_adjuntos(adjuntos)

    if not documentos:
        return {
            "mensaje_id": mensaje_id,
            "estado": "sin_pdf",
            "resultados": [],
        }

    # 7. Procesar cada PDF reutilizando el servicio de recepción validado.
    resultados = []
    for documento in documentos:
        resultado = procesar_pdf_recibido(
            contenido_pdf=documento["contenido"],
            buzon=settings.MS365_MAILBOX,
            mensaje_id=mensaje_id,
            nombre_archivo=documento["nombre"],
            usuario_actual=usuario_servicio,
            departamento_solicitante=departamento,
            solicitante=solicitante,
        )
        resultados.append(resultado)

    return {
        "mensaje_id": mensaje_id,
        "estado": "procesado",
        "resultados": resultados,
    }
def identificar_departamento_remitente(mensaje):
    """Valida el remitente de Microsoft Graph y devuelve su departamento."""

    # Verificar que Microsoft Graph entregue un mensaje válido.
    if not isinstance(mensaje, dict):
        raise ValidationError("El mensaje de Outlook no tiene un formato válido.")

    # Obtener la dirección desde from.emailAddress.address.
    remitente = mensaje.get("from") or {}
    if not isinstance(remitente, dict):
        raise ValidationError("No se pudo identificar el remitente.")

    email_address = remitente.get("emailAddress") or {}
    if not isinstance(email_address, dict):
        raise ValidationError("No se pudo identificar el correo del remitente.")

    correo = email_address.get("address")
    if not isinstance(correo, str) or not correo.strip():
        raise ValidationError("El correo del remitente está vacío.")

    correo = correo.strip().lower()  # Normaliza la dirección para compararla.

    # Consultar únicamente los departamentos permitidos.
    autorizados = getattr(settings, "SDI_REMITENTES_AUTORIZADOS", {})
    departamentos_validos = ("Calidad", "Producción", "Bodega")

    departamentos_encontrados = [
        departamento
        for departamento in departamentos_validos
        if correo in autorizados.get(departamento, [])
    ]

    # Rechazar direcciones desconocidas o asignadas a varios departamentos.
    if len(departamentos_encontrados) != 1:
        raise ValidationError(
            "El remitente no está autorizado o tiene una configuración ambigua."
        )

    return departamentos_encontrados[0]

def obtener_usuario_servicio_outlook():
    """Obtiene el usuario técnico autorizado para registrar SDI desde Outlook."""

    # 1. Leer el nombre configurado para la cuenta técnica.
    nombre_usuario = getattr(settings, "SDI_USUARIO_SERVICIO_OUTLOOK", "")

    if not isinstance(nombre_usuario, str) or not nombre_usuario.strip():
        raise ValidationError("No se ha configurado el usuario técnico de Outlook.")

    nombre_usuario = nombre_usuario.strip()

    # 2. Buscar exclusivamente el usuario configurado.
    modelo_usuario = get_user_model()

    try:
        usuario = modelo_usuario.objects.get(username=nombre_usuario)
    except modelo_usuario.DoesNotExist as error:
        raise ValidationError(
            "El usuario técnico de Outlook no existe."
        ) from error

    # 3. Reutilizar la validación de usuario activo, perfil activo y rol.
    try:
        validar_rol(usuario, [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ])
    except PermissionDenied as error:
        raise ValidationError(
            "El usuario técnico de Outlook no tiene permisos válidos."
        ) from error

    # 4. Devolver el usuario autorizado para mantener la trazabilidad.
    return usuario

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

    # La autorización se comprobará en el futuro servicio que procese cada correo.
    # El departamento y el solicitante deben venir previamente validados.
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

        # Registrar la recepción solo después de importar correctamente la SDI.
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
