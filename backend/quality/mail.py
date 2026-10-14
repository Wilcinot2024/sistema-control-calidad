"""Recepción IMAP y bandeja de salida; no necesita elegir un proveedor ahora."""
import hashlib
import imaplib
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr
from datetime import timedelta
from django.conf import settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.utils import timezone
from .models import NotificacionSDI
from .workflow import receive_pdf


def receive_message(raw):
    if len(raw) > 25 * 1024 * 1024:
        raise ValueError("Correo superior a 25 MB.")
    message = BytesParser(policy=policy.default).parsebytes(raw)
    sender = parseaddr(str(message.get("From", "")))[1].lower()
    if not sender:
        raise ValueError("Correo sin remitente válido.")
    allowed = [s.lower() for s in settings.SDI_ALLOWED_SENDERS]
    if allowed and sender not in allowed:
        raise ValueError("Remitente no autorizado.")
    key = str(message.get("Message-ID", "")) or hashlib.sha256(raw).hexdigest()
    result = []
    for part in message.iter_attachments():
        name = part.get_filename() or "SDI.pdf"
        if part.get_content_type() == "application/pdf" or name.lower().endswith(".pdf"):
            result.append(receive_pdf(part.get_payload(decode=True), name, sender,
                          str(message.get("Subject", ""))[:300], message_key=key, source="correo"))
    if not result:
        raise ValueError("Correo sin PDF adjunto.")
    return result


def poll_mailbox():
    if not settings.SDI_IMAP_HOST or not settings.SDI_IMAP_USER:
        raise ValueError("Configura SDI_IMAP_HOST y SDI_IMAP_USER.")
    with imaplib.IMAP4_SSL(settings.SDI_IMAP_HOST, timeout=30) as mailbox:
        if settings.SDI_IMAP_OAUTH_TOKEN:
            mailbox.authenticate("XOAUTH2", lambda _: f"user={settings.SDI_IMAP_USER}\x01auth=Bearer {settings.SDI_IMAP_OAUTH_TOKEN}\x01\x01".encode())
        else:
            mailbox.login(settings.SDI_IMAP_USER, settings.SDI_IMAP_PASSWORD)
        status, _ = mailbox.select(settings.SDI_IMAP_FOLDER)
        if status != "OK":
            raise ValueError("No se pudo abrir la carpeta IMAP.")
        status, identifiers = mailbox.uid("search", None, "UNSEEN")
        if status != "OK":
            raise ValueError("No se pudo consultar la carpeta IMAP.")
        errors = []
        for uid in identifiers[0].split():
            try:
                status, payload = mailbox.uid("fetch", uid, "(BODY.PEEK[])")
                if status != "OK":
                    raise ValueError("No se pudo leer el mensaje.")
                raw = next(chunk[1] for chunk in payload if isinstance(chunk, tuple))
                receive_message(raw)
                mailbox.uid("store", uid, "+FLAGS", "(\\Seen)")
            except Exception as exc:
                errors.append(f"UID {uid.decode()}: {type(exc).__name__}")
        return errors


def send_notifications():
    # La consola es una vista previa, no una entrega al destinatario.
    if settings.EMAIL_BACKEND.endswith("console.EmailBackend"):
        return 0
    sent = 0
    ids = NotificacionSDI.objects.filter(enviada__isnull=True, proximo_intento__lte=timezone.now()).values_list("pk", flat=True)
    for pk in list(ids):
        with transaction.atomic():
            entry = NotificacionSDI.objects.select_for_update().get(pk=pk)
            if entry.enviada:
                continue
            entry.intentos += 1
            try:
                if not entry.destinatario:
                    raise ValueError("Falta correo de origen; confirma el destinatario antes de asignar.")
                mail = EmailMessage(entry.asunto, entry.mensaje, settings.DEFAULT_FROM_EMAIL, [entry.destinatario],
                    headers={"Message-ID": f"<sdi-{entry.pk}@quality.local>"})
                if mail.send() != 1:
                    raise ValueError("El servidor no confirmó la entrega.")
                entry.enviada = timezone.now()
                entry.error = ""
                sent += 1
            except Exception as exc:
                entry.error = type(exc).__name__ + ": no se pudo entregar el aviso."
                entry.proximo_intento = timezone.now() + timedelta(minutes=min(2 ** min(entry.intentos, 10), 1440))
            entry.save()
    return sent
