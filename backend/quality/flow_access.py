"""Permisos del recorrido SDI, compartidos por las variantes A y B."""

from django.core.exceptions import PermissionDenied, ValidationError

from .models import SDI, PerfilUsuario
from .permissions import obtener_rol

RESPONSABLES = ("administrador", "jefe_calidad", "supervisor")
EJECUCION = (SDI.Estado.EN_PROCESO, SDI.Estado.CORRECCION)


def perfil_activo(user):
    if not obtener_rol(user):
        raise PermissionDenied("Tu cuenta no tiene un perfil activo.")
    return user.perfil


def visibles(user):
    perfil = perfil_activo(user)
    query = SDI.objects.filter(flujo__in=["A", "B"])
    if perfil.rol == PerfilUsuario.Rol.SOLICITANTE:
        return query.filter(creado_por=user)
    if perfil.rol == PerfilUsuario.Rol.INSPECTOR:
        return query.filter(inspector=user)
    if perfil.rol in RESPONSABLES:
        return query
    raise PermissionDenied("Perfil no habilitado para este recorrido.")


def responsable(user):
    if perfil_activo(user).rol not in RESPONSABLES:
        raise PermissionDenied("Esta acción corresponde a los responsables de Calidad.")


def inspector_asignado(user, sdi):
    if perfil_activo(user).rol != "inspector" or sdi.inspector_id != user.pk:
        raise PermissionDenied("La acción corresponde al inspector asignado.")


def entrada_editable(user, sdi):
    perfil = perfil_activo(user)
    if perfil.rol != "solicitante" or sdi.creado_por_id != user.pk:
        raise PermissionDenied("Solo el solicitante original puede completar su solicitud.")
    if sdi.asignada or sdi.estado not in (SDI.Estado.PENDIENTE, SDI.Estado.INFORMACION):
        raise ValidationError("La solicitud solo se completa antes de asignar.")


def capacidades(user, sdi):
    perfil = perfil_activo(user)
    gestor = perfil.rol in RESPONSABLES
    propio = perfil.rol == "solicitante" and sdi.creado_por_id == user.pk
    inspector = perfil.rol == "inspector" and sdi.inspector_id == user.pk
    entrada = not sdi.asignada and sdi.estado in (SDI.Estado.PENDIENTE, SDI.Estado.INFORMACION)
    return {
        "completar": propio and entrada,
        "pedir_info": gestor and entrada,
        "asignar": gestor and entrada and not sdi.solicitud_info,
        "iniciar": inspector and not sdi.iniciada,
        "evaluar": inspector and sdi.estado in EJECUCION,
        "enviar_revision": inspector and sdi.estado in EJECUCION,
        "devolver": False,  # Recorrido de excepción pendiente de la siguiente entrega.
        "cerrar": gestor and sdi.estado == SDI.Estado.REVISION,
        "reasignar": False,
        "diagnostico": gestor,
    }
