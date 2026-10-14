import hashlib
import re
from datetime import date
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from .models import SDI, ItemSDI, InspeccionSDI, DocumentoSDI, NotificacionSDI, HistorialSDI, PerfilUsuario
from .permissions import validar_rol, obtener_rol
from .pdf_intake import extract_proposal

MANAGEMENT_ROLES = [PerfilUsuario.Rol.ADMINISTRADOR, PerfilUsuario.Rol.JEFE_CALIDAD, PerfilUsuario.Rol.SUPERVISOR]


def visible_sdis(user):
    role = obtener_rol(user)
    if not role:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Tu usuario no tiene un perfil activo.")
    records = SDI.objects.select_related("inspector__perfil__area", "creado_por", "asignado_por", "revisada_por")
    if role == PerfilUsuario.Rol.INSPECTOR:
        records = records.filter(inspector=user, asignada__isnull=False)
    return records.order_by("-creada")


def record_event(sdi, user, action, comment="", old=None, item=None, inspection=None):
    return HistorialSDI.objects.create(sdi=sdi, usuario=user, accion=action, comentario=comment, estado_anterior=old, estado_nuevo=sdi.estado, item=item, inspeccion=inspection)


def queue_notification(sdi, event):
    label = "SDI en proceso" if event == "asignacion" else "SDI cerrada"
    message = f"{label}: {sdi.codigo_sdi}\nProyecto: {sdi.proyecto}\n"
    if event == "asignacion":
        message += f"Inspector: {sdi.inspector.get_full_name() or sdi.inspector.username}\n"
        message += "\n".join(f"{item.articulo}: {item.cantidad_a_inspeccionar} unidades a inspeccionar" for item in sdi.items.all())
    else:
        message += f"Resultado antes del cierre: {sdi.resultado_cierre}\n"
        message += "\n".join(f"{item.articulo}: {item.get_resultado_actual_display()}; {item.unidades_liberadas}/{item.cantidad_a_inspeccionar} unidades liberadas" for item in sdi.items.all())
        message += f"\nRevisión: {sdi.comentario_revision}\n"
    notification, _ = NotificacionSDI.objects.get_or_create(sdi=sdi, evento=event, defaults={"destinatario": sdi.correo_origen, "asunto": f"{label} · {sdi.codigo_sdi}"[:250], "mensaje": message})
    return notification


@transaction.atomic
def receive_pdf(content, filename, sender="", subject="", user=None, source="archivo", message_key=""):
    if user:
        validar_rol(user, MANAGEMENT_ROLES)
    if sender:
        validate_email(sender)
    digest = hashlib.sha256(content).hexdigest()
    key = hashlib.sha256((sender.lower() + ":" + message_key + ":" + digest).encode()).hexdigest()
    existing = SDI.objects.filter(clave_recepcion=key).first()
    if existing:
        return existing, False
    text, proposal = extract_proposal(content)
    # La propuesta queda intacta; el registro oficial se completa en revisión.
    sdi, created = SDI.objects.get_or_create(clave_recepcion=key, defaults={"origen": source, "correo_origen": sender, "asunto_correo": subject[:300], "creado_por": user, "datos_pdf": proposal, "texto_pdf": text})
    if not created:
        return sdi, False
    DocumentoSDI.objects.create(sdi=sdi, nombre=filename[:250], sha256=digest, archivo=ContentFile(content, name=digest + ".pdf"))
    record_event(sdi, user, "SDI recibida", f"Origen: {source}. Documento: {filename}. Propuesta pendiente de revisión.")
    return sdi, True


def validate_assignment(sdi):
    errors = []
    if not re.fullmatch(r"[0-9]{1,6}", sdi.activacion_proyecto or ""):
        errors.append("Código de proyecto: entre 1 y 6 dígitos.")
    if not re.fullmatch(r"[0-9]+", sdi.numero_sdi or ""):
        errors.append("Número SDI: solo dígitos.")
    today = timezone.localdate()
    if not sdi.fecha_emision or not date(today.year - 1, 1, 1) <= sdi.fecha_emision <= today:
        errors.append("Fecha de emisión: año actual o anterior, hasta hoy.")
    for field in ["proyecto", "departamento_solicitante", "solicitante"]:
        if not getattr(sdi, field).strip():
            errors.append(f"Completa {field.replace('_', ' ')}.")
    if not sdi.correo_origen:
        errors.append("Indica el correo de Producción/Bodega para las notificaciones.")
    if sdi.correo_origen:
        validate_email(sdi.correo_origen)
    items = list(sdi.items.select_for_update())
    if not items:
        errors.append("Agrega al menos un producto antes de asignar.")
    for item in items:
        if not item.articulo.strip() or item.cantidad_a_inspeccionar < 1:
            errors.append("Cada producto necesita artículo y cantidad a inspeccionar positiva.")
        if item.cantidad_indicada is not None and item.cantidad_a_inspeccionar > item.cantidad_indicada:
            errors.append(f"La cantidad a inspeccionar de {item.articulo} supera la cantidad indicada.")
    if errors:
        raise ValidationError(errors)
    return items


@transaction.atomic
def assign_sdi(sdi_id, user, inspector, instructions=""):
    validar_rol(user, MANAGEMENT_ROLES)
    sdi = SDI.objects.select_for_update().get(pk=sdi_id)
    if sdi.asignada or sdi.estado != SDI.Estado.PENDIENTE:
        raise ValidationError("La SDI ya fue asignada o dejó de estar pendiente.")
    profile = getattr(inspector, "perfil", None)
    if not inspector.is_active or not profile or not profile.activo or profile.rol != PerfilUsuario.Rol.INSPECTOR:
        raise ValidationError("Selecciona un inspector activo.")
    items = validate_assignment(sdi)
    sdi.inspector = inspector
    sdi.instrucciones = instructions.strip()
    sdi.asignada = timezone.now()
    sdi.asignado_por = user
    sdi.estado = SDI.Estado.EN_PROCESO
    sdi.save()
    from .services import crear_inspeccion
    for item in items:
        crear_inspeccion(user, item.id, inspector, item.cantidad_a_inspeccionar, observations(sdi, item))
    sdi.refresh_from_db()
    record_event(sdi, user, "SDI asignada", f"Inspector: {inspector.username}. Cantidades confirmadas: " + "; ".join(f"{i.articulo}: {i.cantidad_a_inspeccionar}" for i in items), SDI.Estado.PENDIENTE)
    queue_notification(sdi, "asignacion")
    return sdi


def observations(sdi, item):
    return "\n".join(value for value in [sdi.instrucciones, item.observaciones] if value)


@transaction.atomic
def review_results(sdi_id, user, comment=""):
    validar_rol(user, MANAGEMENT_ROLES)
    sdi = SDI.objects.select_for_update().get(pk=sdi_id)
    if not sdi.asignada or sdi.estado == SDI.Estado.CERRADA:
        raise ValidationError("Solo se revisan resultados de SDI asignadas y abiertas.")
    inspections = InspeccionSDI.objects.filter(item__sdi=sdi)
    if not inspections.exists() or inspections.filter(resultado=InspeccionSDI.Resultado.EN_PROCESO).exists():
        raise ValidationError("Finaliza las inspecciones antes de revisar el resultado.")
    sdi.revisada = timezone.now()
    sdi.revisada_por = user
    sdi.comentario_revision = comment.strip()
    sdi.save(update_fields=["revisada", "revisada_por", "comentario_revision", "actualizada"])
    record_event(sdi, user, "Resultados revisados", comment)
    return sdi


def invalidate_review(sdi):
    if sdi.revisada:
        SDI.objects.filter(pk=sdi.pk).update(revisada=None, revisada_por=None, comentario_revision="")
        sdi.revisada = None
        sdi.revisada_por = None


@transaction.atomic
def annul_sdi(sdi_id, user, reason):
    validar_rol(user, MANAGEMENT_ROLES)
    reason = reason.strip()
    if not reason or len(reason) > 1000:
        raise ValidationError("Indica un motivo de anulación de entre 1 y 1000 caracteres.")
    sdi = SDI.objects.select_for_update().get(pk=sdi_id)
    if sdi.estado != SDI.Estado.PENDIENTE or sdi.asignada or sdi.items.filter(inspecciones__isnull=False).exists():
        raise ValidationError("Solo se anulan SDI pendientes, sin asignación ni inspecciones.")
    if sdi.archivada:
        raise ValidationError("Restaura la SDI antes de anularla.")
    old = sdi.estado
    sdi.estado = SDI.Estado.ANULADA
    sdi.anulada = timezone.now()
    sdi.anulada_por = user
    sdi.motivo_anulacion = reason
    sdi.save(update_fields=["estado", "anulada", "anulada_por", "motivo_anulacion", "actualizada"])
    record_event(sdi, user, "SDI anulada", reason, old)
    return sdi


@transaction.atomic
def archive_sdi(sdi_id, user, archived):
    validar_rol(user, MANAGEMENT_ROLES)
    sdi = SDI.objects.select_for_update().get(pk=sdi_id)
    if archived and sdi.estado == SDI.Estado.PENDIENTE:
        raise ValidationError("Una SDI pendiente debe revisarse o anularse antes de archivarla.")
    if bool(sdi.archivada) == archived:
        raise ValidationError("La SDI ya se encuentra en esa vista.")
    sdi.archivada = timezone.now() if archived else None
    sdi.archivada_por = user if archived else None
    sdi.save(update_fields=["archivada", "archivada_por", "actualizada"])
    record_event(sdi, user, "SDI archivada" if archived else "SDI restaurada", "Se conserva la documentación, los productos y las inspecciones. El estado operativo no cambia.")
    return sdi
