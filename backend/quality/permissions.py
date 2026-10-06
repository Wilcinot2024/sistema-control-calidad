# =========================================================
# ÍTEM 9 - PERMISOS POR ROL
# =========================================================

from django.core.exceptions import PermissionDenied

from .models import PerfilUsuario


# 9.1 - Obtener rol activo
def obtener_rol(usuario):

    if not usuario or not usuario.is_authenticated:
        return None

    if not usuario.is_active:
        return None

    try:
        perfil = usuario.perfil
    except PerfilUsuario.DoesNotExist:
        return None

    if not perfil.activo:
        return None

    return perfil.rol


# 9.2 - Validar roles permitidos
def validar_rol(usuario, roles_permitidos):

    rol = obtener_rol(usuario)

    if rol not in roles_permitidos:
        raise PermissionDenied(
            "No tienes permisos para realizar esta acción."
        )

    return rol


# 9.3 - Gestión de inspectores
def puede_gestionar_inspectores(usuario):

    rol = obtener_rol(usuario)

    return rol in [
        PerfilUsuario.Rol.ADMINISTRADOR,
        PerfilUsuario.Rol.JEFE_CALIDAD,
        PerfilUsuario.Rol.SUPERVISOR,
    ]


# 9.4 - Gestión general de SDI
def puede_gestionar_sdi(usuario):

    rol = obtener_rol(usuario)

    return rol in [
        PerfilUsuario.Rol.ADMINISTRADOR,
        PerfilUsuario.Rol.JEFE_CALIDAD,
        PerfilUsuario.Rol.SUPERVISOR,
    ]


# 9.5 - Trabajar inspecciones
def puede_inspeccionar(usuario):

    rol = obtener_rol(usuario)

    return rol in [
        PerfilUsuario.Rol.ADMINISTRADOR,
        PerfilUsuario.Rol.JEFE_CALIDAD,
        PerfilUsuario.Rol.SUPERVISOR,
        PerfilUsuario.Rol.INSPECTOR,
    ]
# 9.7 - Validar acceso a una inspección
def validar_acceso_inspeccion(usuario, inspeccion):

    rol = validar_rol(
        usuario,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
            PerfilUsuario.Rol.INSPECTOR,
        ],
    )

    # Inspector solo puede trabajar sus inspecciones
    if (
        rol == PerfilUsuario.Rol.INSPECTOR
        and inspeccion.inspector_id != usuario.id
    ):
        raise PermissionDenied(
            "No tienes permiso para trabajar esta inspección."
        )

    return rol