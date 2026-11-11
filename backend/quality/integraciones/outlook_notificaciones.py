
import requests  # Permite enviar solicitudes HTTP a Microsoft Graph.
from urllib.parse import quote  # Codifica la dirección del buzón.
from django.conf import settings  # Consulta la configuración corporativa.
from django.core.exceptions import ValidationError  # Gestiona errores controlados.
from django.core.validators import validate_email  # Valida destinatarios.
from django.db import transaction  # Protege las actualizaciones.
from django.utils import timezone  # Registra la fecha de aceptación.

from quality.models import NotificacionSDI  # Reutiliza las notificaciones existentes.
from .outlook_service import obtener_token_outlook  # Reutiliza Microsoft Entra ID.


def obtener_destinatario(notificacion):
    """Identifica el destinatario sin modificar la notificación."""

    # 1. Priorizar un correo específico, cuando esté configurado.
    correo = (notificacion.correo_destinatario or "").strip()

    # 2. Si no existe, utilizar el correo del departamento correspondiente.
    if not correo:
        departamentos = getattr(settings, "SDI_CORREOS_DEPARTAMENTOS", {})
        correo = departamentos.get(notificacion.departamento_destinatario, "").strip()

    # 3. Impedir envíos sin un destinatario válido.
    if not correo:
        raise ValidationError("No existe un correo configurado para el destinatario.")

    validate_email(correo)
    return correo


def preparar_notificacion(notificacion_id):
    """Prepara un correo sin enviarlo ni modificar PostgreSQL."""

    # 1. Consultar la notificación seleccionada.
    notificacion = NotificacionSDI.objects.get(pk=notificacion_id)

    # 2. Evitar preparar mensajes que ya fueron aceptados para envío.
    if notificacion.estado_envio == NotificacionSDI.EstadoEnvio.ENVIADA:
        raise ValidationError("Esta notificación ya fue procesada como enviada.")

    # 3. Identificar el destinatario autorizado.
    destinatario = obtener_destinatario(notificacion)

    # 4. Preparar el formato requerido por Microsoft Graph.
    return {
        "message": {
            "subject": notificacion.asunto,
            "body": {
                "contentType": "Text",
                "content": notificacion.mensaje,
            },
            "toRecipients": [
                {"emailAddress": {"address": destinatario}}
            ],
        },
        "saveToSentItems": True,
    }


def enviar_notificacion_outlook(notificacion_id, habilitar_envio=False):
    """Envía una notificación específica solo con autorización explícita."""

    # 1. Mantener desactivado el envío por defecto.
    if not habilitar_envio:
        raise ValidationError("Envío real desactivado por seguridad.")

    # 2. Exigir la configuración corporativa antes de realizar conexiones.
    if not all([
        settings.MS365_TENANT_ID,
        settings.MS365_CLIENT_ID,
        settings.MS365_CLIENT_SECRET,
        settings.MS365_MAILBOX,
    ]):
        raise ValidationError("Microsoft 365 todavía no está configurado.")

    # 3. Bloquear el registro para evitar dos envíos simultáneos desde Django.
    with transaction.atomic():
        notificacion = NotificacionSDI.objects.select_for_update().get(
            pk=notificacion_id
        )

        # 4. Impedir repetir una solicitud aceptada anteriormente.
        if notificacion.estado_envio == NotificacionSDI.EstadoEnvio.ENVIADA:
            raise ValidationError("La notificación ya figura como enviada.")

        # 5. Construir el mensaje con las validaciones existentes.
        contenido = preparar_notificacion(notificacion.pk)

        # 6. Obtener autorización de Microsoft Graph.
        token = obtener_token_outlook()
        buzon = quote(settings.MS365_MAILBOX, safe="")
        url = f"{settings.MS365_GRAPH_URL}/users/{buzon}/sendMail"

        # 7. Enviar únicamente esta notificación.
        respuesta = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=contenido,
            timeout=30,
        )

        # 8. Exigir la respuesta de aceptación documentada por Microsoft.
        if respuesta.status_code != 202:
            raise ValidationError(
                "Microsoft Graph no confirmó la aceptación del mensaje."
            )

        # 9. Registrar que Microsoft aceptó la solicitud de envío.
        notificacion.estado_envio = NotificacionSDI.EstadoEnvio.ENVIADA
        notificacion.fecha_envio = timezone.now()
        notificacion.save(update_fields=["estado_envio", "fecha_envio"])

        return {
            "notificacion_id": notificacion.pk,
            "estado": "aceptada_por_graph",
        }
