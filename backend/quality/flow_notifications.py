"""Preparación transaccional de avisos; la primera entrega solo captura correo."""

from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .flow_access import RESPONSABLES
from .models import AvisoSDI, DepartamentoSDI, NotificacionSDI, PerfilUsuario


def revisores():
    return PerfilUsuario.objects.filter(
        rol__in=RESPONSABLES, activo=True, usuario__is_active=True,
    ).select_related("usuario")


def emitir(sdi, evento, mensaje):
    """Invocar dentro de la misma transacción y con el bloqueo de la SDI."""
    sdi.paso_flujo += 1
    sdi.save(update_fields=["paso_flujo", "actualizada"])
    gestores = list(revisores())
    usuarios, correos = [], []
    if evento in ("alta", "revision"):
        usuarios = [p.usuario for p in gestores]
        seleccion = set(settings.SDI_REVIEWER_USERNAMES)
        correos = [p.usuario.email for p in gestores if p.usuario.username in seleccion]
    elif evento in ("asignacion", "devolucion"):
        usuarios = [sdi.inspector]
        correos = [sdi.inspector.email]
    elif evento == "informacion":
        usuarios = [sdi.creado_por]
    if evento in ("inicio", "cierre", "informacion"):
        depto = DepartamentoSDI.objects.get(nombre=sdi.departamento_solicitante)
        correos = [depto.correo]
    for user in usuarios:
        AvisoSDI.objects.get_or_create(
            usuario=user, sdi=sdi, evento=evento, ocurrencia=sdi.paso_flujo,
            defaults={"mensaje": mensaje},
        )
    # Un destino ausente sigue visible como error de configuración en la cola.
    for destino in sorted(set(correos or [""])):
        NotificacionSDI.objects.get_or_create(
            sdi=sdi, evento=evento, ocurrencia=sdi.paso_flujo, destinatario=destino,
            defaults={"asunto": f"{sdi.codigo_sdi}: {evento}", "mensaje": mensaje},
        )


@transaction.atomic
def capturar_pendientes():
    """Transporte local: nunca marca un mensaje como entregado al proveedor."""
    total = 0
    for aviso in NotificacionSDI.objects.select_for_update().filter(sdi__flujo__in=["A", "B"], capturada__isnull=True):
        aviso.intentos += 1
        try:
            validate_email(aviso.destinatario)
            aviso.capturada = timezone.now()
            aviso.error = ""
            total += 1
        except ValidationError:
            aviso.error = "Configura un destinatario válido antes de capturar este aviso."
        aviso.save(update_fields=["capturada", "intentos", "error"])
    return total
