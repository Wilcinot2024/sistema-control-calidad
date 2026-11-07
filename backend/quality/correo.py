"""Recepción IMAP de SDI y entrega SMTP de los avisos existentes."""
from datetime import date, timedelta
from email import policy
from email.parser import BytesParser
from email.utils import getaddresses
import hashlib
import imaplib
from io import BytesIO

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage, mailers
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from pypdf import PdfReader

from .integraciones.sdi_pdf_parser import procesar_pdf_sdi
from .models import HistorialSDI, NotificacionSDI, PerfilUsuario, RecepcionCorreoSDI
from .permissions import validar_rol
from .services import crear_item_sdi, crear_sdi, registrar_notificacion_sdi

MAX_CORREO = 25 * 1024 * 1024
MAX_PDF = 10 * 1024 * 1024
SMTP = "django.core.mail.backends.smtp.EmailBackend"


def _validar_pdf(contenido):
    if not contenido or len(contenido) > MAX_PDF or not contenido.startswith(b"%PDF-"):
        raise ValidationError("El adjunto debe ser un PDF de hasta 10 MB.")
    try:
        documento = PdfReader(BytesIO(contenido))
        if documento.is_encrypted or len(documento.pages) > 100:
            raise ValidationError("El PDF no puede estar cifrado ni superar 100 páginas.")
    except ValidationError:
        raise
    except Exception as error:
        raise ValidationError("No se pudo abrir el PDF adjunto.") from error


@transaction.atomic
def recibir_mensaje(raw):
    """Todo el mensaje se confirma o se revierte; reenviar un PDF no duplica SDI."""
    if not isinstance(raw, bytes) or len(raw) > MAX_CORREO:
        raise ValidationError("El correo debe contener hasta 25 MB.")
    mensaje = BytesParser(policy=policy.default).parsebytes(raw)
    if len(mensaje.get_all("From", [])) != 1:
        raise ValidationError("El mensaje debe tener un único remitente.")
    direcciones = getaddresses([str(mensaje["From"])])
    if len(direcciones) != 1:
        raise ValidationError("El remitente no es válido.")
    nombre, remitente = direcciones[0]
    remitente = remitente.strip().lower()
    validate_email(remitente)
    autorizados = {correo.lower(): departamento for correo, departamento in settings.SDI_CORREO_REMITENTES.items()}
    departamento = autorizados.get(remitente)
    if departamento not in {"Calidad", "Producción", "Bodega"}:
        raise ValidationError("El remitente no tiene un departamento autorizado.")
    usuario = get_user_model().objects.get(username=settings.SDI_CORREO_USUARIO)
    validar_rol(usuario, [PerfilUsuario.Rol.ADMINISTRADOR, PerfilUsuario.Rol.JEFE_CALIDAD, PerfilUsuario.Rol.SUPERVISOR])
    resultado = []
    for parte in mensaje.iter_attachments():
        archivo = (parte.get_filename() or "SDI.pdf").replace("\\", "/").rsplit("/", 1)[-1][:250]
        if parte.get_content_type() != "application/pdf" and not archivo.lower().endswith(".pdf"):
            continue
        contenido = parte.get_payload(decode=True)
        _validar_pdf(contenido)
        digest = hashlib.sha256(contenido).hexdigest()
        clave = hashlib.sha256(f"{remitente}:{digest}".encode()).hexdigest()
        anterior = RecepcionCorreoSDI.objects.filter(clave=clave).first()
        if anterior:
            resultado.append((anterior.sdi_id, False))
            continue
        propuesta = procesar_pdf_sdi(contenido)
        generales = dict(propuesta["datos_generales"])
        generales["fecha_emision"] = date.fromisoformat(generales["fecha_emision"])
        sdi = crear_sdi(
            usuario_actual=usuario, **generales,
            departamento_solicitante=departamento,
            solicitante=(nombre or remitente)[:150],
        )
        sdi.full_clean()
        for datos in propuesta["articulos"]:
            producto = crear_item_sdi(usuario_actual=usuario, sdi_id=sdi.pk, **datos)
            producto.full_clean()
        RecepcionCorreoSDI.objects.create(
            sdi=sdi, clave=clave, remitente=remitente,
            mensaje_id=str(mensaje.get("Message-ID", ""))[:998],
            nombre_archivo=archivo, sha256=digest, pdf_original=contenido,
        )
        HistorialSDI.objects.create(
            sdi=sdi, usuario=usuario, accion="SDI recibida por correo",
            estado_nuevo=sdi.estado, comentario=f"Remitente: {remitente}. PDF: {archivo}.",
        )
        registrar_notificacion_sdi(
            sdi, NotificacionSDI.Evento.RECEPCION, "Calidad",
            f"Nueva solicitud {sdi.codigo_sdi}",
            f"Se recibió {sdi.codigo_sdi} por correo de {remitente}. Pendiente de asignación.",
        )
        resultado.append((sdi.pk, True))
    if not resultado:
        raise ValidationError("El correo no tiene PDF adjuntos.")
    return resultado


def consultar_buzon(limite=100):
    """No marca como leído hasta confirmar todos los PDF en la base de datos."""
    if not all([settings.SDI_IMAP_HOST, settings.SDI_IMAP_USUARIO, settings.SDI_CORREO_USUARIO]):
        raise ValidationError("Configura el host IMAP, el buzón y el usuario operativo.")
    if not settings.SDI_IMAP_PASSWORD and not settings.SDI_IMAP_OAUTH_TOKEN:
        raise ValidationError("Configura la autenticación IMAP.")
    errores = []
    with imaplib.IMAP4_SSL(settings.SDI_IMAP_HOST, timeout=30) as buzon:
        if settings.SDI_IMAP_OAUTH_TOKEN:
            auth = f"user={settings.SDI_IMAP_USUARIO}\x01auth=Bearer {settings.SDI_IMAP_OAUTH_TOKEN}\x01\x01".encode()
            estado, _ = buzon.authenticate("XOAUTH2", lambda _: auth)
        else:
            estado, _ = buzon.login(settings.SDI_IMAP_USUARIO, settings.SDI_IMAP_PASSWORD)
        if estado != "OK":
            raise ValidationError("No se pudo autenticar el buzón IMAP.")
        estado, _ = buzon.select(settings.SDI_IMAP_CARPETA)
        if estado != "OK":
            raise ValidationError("No se pudo abrir la carpeta IMAP.")
        estado, identificadores = buzon.uid("search", None, "UNSEEN")
        if estado != "OK":
            raise ValidationError("No se pudo consultar la carpeta IMAP.")
        for uid in (identificadores[0] or b"").split()[:limite]:
            try:
                estado, datos = buzon.uid("fetch", uid, "(BODY.PEEK[])")
                if estado != "OK":
                    raise ValidationError("No se pudo leer el correo.")
                raw = next(dato[1] for dato in datos if isinstance(dato, tuple))
                recibir_mensaje(raw)
                estado, _ = buzon.uid("store", uid, "+FLAGS", "(\\Seen)")
                if estado != "OK":
                    raise ValidationError("No se pudo actualizar la marca de lectura.")
            except Exception as error:
                # No registrar texto de excepciones que pueda contener credenciales.
                errores.append(f"UID {uid.decode('ascii', errors='replace')}: {type(error).__name__}")
    return errores


def _destinatario(aviso):
    if aviso.correo_destinatario:
        return aviso.correo_destinatario
    if aviso.evento in {NotificacionSDI.Evento.INICIO, NotificacionSDI.Evento.CIERRE}:
        origen = aviso.sdi.correos_recibidos.order_by("pk").first()
        if origen:
            return origen.remitente
    return settings.SDI_CORREO_DESTINATARIOS.get(aviso.departamento_destinatario, "")


def enviar_avisos(limite=100):
    """Entrega avisos existentes sin cambiar estados, revisiones o inspecciones."""
    if settings.MAILERS.get("default", {}).get("BACKEND") != SMTP:
        # Consola, archivos y buzones simulados no acreditan una entrega real.
        return 0
    pendientes = NotificacionSDI.objects.exclude(
        estado_envio=NotificacionSDI.EstadoEnvio.ENVIADA,
    ).filter(proximo_intento__lte=timezone.now()).order_by("pk").values_list("pk", flat=True)[:limite]
    enviados = 0
    for pk in list(pendientes):
        with transaction.atomic():
            aviso = NotificacionSDI.objects.select_for_update().get(pk=pk)
            if aviso.estado_envio == NotificacionSDI.EstadoEnvio.ENVIADA or aviso.proximo_intento > timezone.now():
                continue
            aviso.intentos += 1
            try:
                destino = _destinatario(aviso)
                validate_email(destino)
                validate_email(settings.DEFAULT_FROM_EMAIL)
                aviso.correo_destinatario = destino
                correo = EmailMessage(
                    subject=aviso.asunto, body=aviso.mensaje,
                    from_email=settings.DEFAULT_FROM_EMAIL, to=[destino],
                    headers={"Message-ID": f"<sdi-{aviso.pk}@{settings.DEFAULT_FROM_EMAIL.rsplit('@', 1)[-1]}>"},
                )
                if mailers.default.send_messages([correo]) != 1:
                    raise RuntimeError("No se confirmó la entrega SMTP.")
                aviso.estado_envio = NotificacionSDI.EstadoEnvio.ENVIADA
                aviso.fecha_envio = timezone.now()
                aviso.ultimo_error = ""
                enviados += 1
            except Exception as error:
                aviso.estado_envio = NotificacionSDI.EstadoEnvio.ERROR
                aviso.ultimo_error = f"{type(error).__name__}: no se pudo entregar el aviso."
                espera = min(2 ** min(aviso.intentos, 11), 1440)
                aviso.proximo_intento = timezone.now() + timedelta(minutes=espera)
            aviso.save(update_fields=["intentos", "correo_destinatario", "estado_envio", "fecha_envio", "ultimo_error", "proximo_intento"])
    return enviados
