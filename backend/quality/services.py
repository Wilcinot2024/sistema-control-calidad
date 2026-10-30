# =========================================================
# ÍTEM 1 - IMPORTACIONES
# =========================================================

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone
from django.db.models import Max
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.admin.models import ADDITION, CHANGE, LogEntry
from .permissions import (
    validar_rol,
    validar_acceso_inspeccion,
    obtener_roles_gestionables,
)


from .models import (
    SDI,
    ItemSDI,
    InspeccionSDI,
    InspeccionVisual,
    RechazoSDI,
    ConcesionSDI,
    HistorialSDI,
    PerfilUsuario,
    Area,
)


# =========================================================
# ÍTEM 2 - RECALCULAR ESTADO DE LA SDI
# =========================================================

def recalcular_estado_sdi(sdi, invalidar_revision=True):

    if sdi.flujo:
        # Los resultados técnicos no adelantan las etapas del nuevo recorrido.
        return sdi.estado

    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        return sdi.estado
    if invalidar_revision:
        from .workflow import invalidate_review
        invalidate_review(sdi)

    items = list(sdi.items.all())

    # SDI sin productos
    if not items:
        nuevo_estado = SDI.Estado.PENDIENTE

    # Todos los productos aprobados
    elif all(
        item.resultado_actual == ItemSDI.Resultado.APROBADA
        for item in items
    ):
        nuevo_estado = SDI.Estado.APROBADA

    # Existe producto rechazado
    elif any(
        item.resultado_actual == ItemSDI.Resultado.RECHAZADA
        for item in items
    ):
        nuevo_estado = SDI.Estado.RECHAZADA

    # Existe producto en concesión
    elif any(
        item.resultado_actual == ItemSDI.Resultado.CONCESION
        for item in items
    ):
        nuevo_estado = SDI.Estado.CONCESION

    # Existe producto en proceso
    elif any(
        item.resultado_actual == ItemSDI.Resultado.EN_PROCESO
        for item in items
    ):
        nuevo_estado = SDI.Estado.EN_PROCESO

    else:
        nuevo_estado = SDI.Estado.EN_PROCESO if sdi.asignada else SDI.Estado.PENDIENTE

    # Guardar nuevo estado
    if sdi.estado != nuevo_estado:
        sdi.estado = nuevo_estado

        sdi.save(
            update_fields=[
                "estado",
                "actualizada",
            ]
        )

    return nuevo_estado


# =========================================================
# ÍTEM 3 - PROCESAR INSPECCIÓN
# =========================================================

@transaction.atomic
def aprobar_inspeccion(
    inspeccion_id,
    usuario,
    cantidad_aprobada=None
):

    # 3.1 - Obtener inspección
    inspeccion = (
        InspeccionSDI.objects
        .select_for_update()
        .select_related("item__sdi")
        .get(pk=inspeccion_id)
    )
    # 9.7 - Validar acceso
    validar_acceso_inspeccion(
    usuario,
    inspeccion,
    )

    # 3.2 - Obtener producto
    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    # 3.3 - Obtener SDI
    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    # 3.4 - Validaciones
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se puede procesar una inspección de una SDI cerrada."
        )

    if inspeccion.resultado != InspeccionSDI.Resultado.EN_PROCESO:
        raise ValidationError(
            "Solo se pueden procesar inspecciones que estén en proceso."
        )

    if cantidad_aprobada is None:
        cantidad_aprobada = inspeccion.cantidad_inspeccionada

    if cantidad_aprobada < 0:
        raise ValidationError(
            "La cantidad aprobada no puede ser negativa."
        )

    if cantidad_aprobada > inspeccion.cantidad_inspeccionada:
        raise ValidationError(
            "La cantidad aprobada no puede superar "
            "la cantidad inspeccionada."
        )

    # 3.5 - Validar inspección visual
    try:
        visual = inspeccion.inspeccion_visual

    except InspeccionVisual.DoesNotExist:
        raise ValidationError(
            "La inspección debe tener una inspección visual registrada."
        )

    cantidad_rechazada = (
        inspeccion.cantidad_inspeccionada
        - cantidad_aprobada
    )

    if (
        cantidad_rechazada == 0
        and visual.resultado_visual
        != InspeccionVisual.Criterio.CONFORME
    ):
        raise ValidationError(
            "No se puede aprobar la totalidad porque existen "
            "criterios visuales no conformes."
        )

    # 3.6 - Calcular unidades liberadas
    nuevas_unidades_liberadas = (
        item.unidades_liberadas
        + cantidad_aprobada
    )

    if nuevas_unidades_liberadas > item.cantidad_a_inspeccionar:
        raise ValidationError(
            "Las unidades aprobadas acumuladas no pueden superar "
            "la cantidad total a inspeccionar."
        )

    estado_anterior_sdi = sdi.estado

    inspeccion.cantidad_aprobada = cantidad_aprobada
    inspeccion.fecha_fin = timezone.now()

    # 3.7 - Definir resultado
    if cantidad_aprobada == inspeccion.cantidad_inspeccionada:

        inspeccion.resultado = (
            InspeccionSDI.Resultado.APROBADA
        )

        accion = "Inspección aprobada"

    elif cantidad_aprobada > 0:

        inspeccion.resultado = (
            InspeccionSDI.Resultado.PARCIAL
        )

        accion = "Inspección parcialmente aprobada"

    else:

        inspeccion.resultado = (
            InspeccionSDI.Resultado.RECHAZADA
        )

        accion = "Inspección rechazada"

    # 3.8 - Guardar inspección
    inspeccion.save(
        update_fields=[
            "cantidad_aprobada",
            "resultado",
            "fecha_fin",
            "actualizada",
        ]
    )

    # 3.9 - Actualizar producto
    item.unidades_liberadas = nuevas_unidades_liberadas

    if (
        item.unidades_liberadas
        == item.cantidad_a_inspeccionar
    ):
        item.resultado_actual = (
            ItemSDI.Resultado.APROBADA
        )

    elif item.unidades_liberadas > 0:

        item.resultado_actual = (
            ItemSDI.Resultado.EN_PROCESO
        )

    else:

        item.resultado_actual = (
            ItemSDI.Resultado.RECHAZADA
        )

    item.save(
        update_fields=[
            "unidades_liberadas",
            "resultado_actual",
            "actualizado",
        ]
    )

    # 3.10 - Actualizar SDI
    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

    # 3.11 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        inspeccion=inspeccion,
        usuario=usuario,
        accion=accion,
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=nuevo_estado_sdi,
        comentario=(
            f"Inspección #{inspeccion.numero_inspeccion}. "
            f"Inspeccionadas: {inspeccion.cantidad_inspeccionada}. "
            f"Aprobadas: {cantidad_aprobada}. "
            f"No conformes: {cantidad_rechazada}. "
            f"Total liberadas acumuladas: "
            f"{item.unidades_liberadas}."
        ),
    )

    return inspeccion


# =========================================================
# ÍTEM 4 - RECHAZAR INSPECCIÓN
# =========================================================

@transaction.atomic
def rechazar_inspeccion(
    inspeccion_id,
    usuario,
    motivo,
    descripcion,
    cantidad_afectada
):

    # 4.1 - Obtener inspección
    inspeccion = (
        InspeccionSDI.objects
        .select_for_update()
        .select_related("item__sdi")
        .get(pk=inspeccion_id)
    )
    # 9.7 - Validar acceso
    validar_acceso_inspeccion(
    usuario,
    inspeccion,
    )

    item = inspeccion.item
    # 4.2 - Obtener producto
    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    # 4.3 - Obtener SDI
    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    # 4.4 - Validaciones
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se puede rechazar una inspección de una SDI cerrada."
        )

    if inspeccion.resultado != InspeccionSDI.Resultado.EN_PROCESO:
        raise ValidationError(
            "Solo se pueden rechazar inspecciones que estén en proceso."
        )

    if cantidad_afectada <= 0:
        raise ValidationError(
            "La cantidad afectada debe ser mayor que cero."
        )

    if cantidad_afectada > inspeccion.cantidad_inspeccionada:
        raise ValidationError(
            "La cantidad afectada no puede superar "
            "la cantidad inspeccionada."
        )

    estado_anterior_sdi = sdi.estado

    # 4.5 - Crear rechazo
    rechazo = RechazoSDI.objects.create(
        inspeccion=inspeccion,
        motivo=motivo,
        descripcion=descripcion,
        cantidad_afectada=cantidad_afectada,
        registrado_por=usuario,
    )

    # 4.6 - Actualizar inspección
    inspeccion.resultado = (
        InspeccionSDI.Resultado.RECHAZADA
    )

    inspeccion.fecha_fin = timezone.now()

    inspeccion.save(
        update_fields=[
            "resultado",
            "fecha_fin",
            "actualizada",
        ]
    )

    # 4.7 - Actualizar producto
    item.resultado_actual = (
        ItemSDI.Resultado.RECHAZADA
    )

    item.save(
        update_fields=[
            "resultado_actual",
            "actualizado",
        ]
    )

    # 4.8 - Actualizar SDI
    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

    # 4.9 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        inspeccion=inspeccion,
        usuario=usuario,
        accion="Inspección rechazada",
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=nuevo_estado_sdi,
        comentario=(
            f"Inspección #{inspeccion.numero_inspeccion} rechazada. "
            f"Cantidad afectada: {cantidad_afectada}. "
            f"Motivo: {rechazo.get_motivo_display()}."
        ),
    )

    return rechazo


# =========================================================
# ÍTEM 5 - CREAR REINSPECCIÓN
# =========================================================

@transaction.atomic
def crear_reinspeccion(
    item_id,
    inspector,
    usuario,
    cantidad_inspeccionada,
    observaciones=""
):
        # 9.8.1 - Validar permisos
    validar_rol(
        usuario,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    # 5.1 - Obtener producto
    item = (
        ItemSDI.objects
        .select_for_update()
        .select_related("sdi")
        .get(pk=item_id)
    )

    # 5.2 - Obtener SDI
    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    perfil = getattr(inspector, "perfil", None)
    if not sdi.asignada or sdi.inspector_id != inspector.id or not inspector.is_active or not perfil or not perfil.activo or perfil.rol != PerfilUsuario.Rol.INSPECTOR:
        raise ValidationError("La reinspección requiere el inspector activo asignado a la SDI.")

    # 5.3 - Validaciones
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se puede crear una reinspección "
            "para una SDI cerrada."
        )

    if cantidad_inspeccionada <= 0:
        raise ValidationError(
            "La cantidad a reinspeccionar debe ser mayor que cero."
        )

    # 5.4 - Calcular cantidad pendiente
    cantidad_pendiente = (
        item.cantidad_a_inspeccionar
        - item.unidades_liberadas
    )

    if cantidad_inspeccionada > cantidad_pendiente:
        raise ValidationError(
            "La cantidad a reinspeccionar no puede superar "
            "la cantidad pendiente del ítem."
        )

    # 5.5 - Validar inspección activa
    if InspeccionSDI.objects.filter(
        item=item,
        resultado=InspeccionSDI.Resultado.EN_PROCESO
    ).exists():

        raise ValidationError(
            "Ya existe una inspección en proceso para este ítem."
        )

    # 5.6 - Obtener última inspección
    ultima_inspeccion = (
        InspeccionSDI.objects
        .filter(item=item)
        .order_by("-numero_inspeccion")
        .first()
    )

    if not ultima_inspeccion:
        raise ValidationError(
            "El ítem no tiene una inspección anterior."
        )

    if ultima_inspeccion.resultado not in [
        InspeccionSDI.Resultado.RECHAZADA,
        InspeccionSDI.Resultado.PARCIAL,
    ]:
        raise ValidationError(
            "Solo se puede crear una reinspección después "
            "de un rechazo o una aprobación parcial."
        )

    # 5.7 - Generar número de reinspección
    max_numero = (
        InspeccionSDI.objects
        .filter(item=item)
        .aggregate(
            max_numero=Max("numero_inspeccion")
        )
        ["max_numero"]
    )

    nuevo_numero = (max_numero or 0) + 1
    estado_anterior_sdi = sdi.estado

    # 5.8 - Crear reinspección
    nueva_inspeccion = InspeccionSDI.objects.create(
        item=item,
        numero_inspeccion=nuevo_numero,
        inspector=inspector,
        cantidad_inspeccionada=cantidad_inspeccionada,
        resultado=InspeccionSDI.Resultado.EN_PROCESO,
        fecha_inicio=timezone.now(),
        observaciones=observaciones,
    )

    # 5.9 - Actualizar producto
    item.resultado_actual = (
        ItemSDI.Resultado.EN_PROCESO
    )

    item.save(
        update_fields=[
            "resultado_actual",
            "actualizado",
        ]
    )

    # 5.10 - Actualizar SDI
    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

    # 5.11 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        inspeccion=nueva_inspeccion,
        usuario=usuario,
        accion="Reinspección iniciada",
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=nuevo_estado_sdi,
        comentario=(
            f"Se inició la reinspección #{nuevo_numero}. "
            f"Cantidad a reinspeccionar: "
            f"{cantidad_inspeccionada} unidades."
        ),
    )

    return nueva_inspeccion
# =========================================================
# ÍTEM 6 - GESTIONAR CONCESIÓN
# =========================================================


# 6.1 - Solicitar concesión
@transaction.atomic
def solicitar_concesion(
    inspeccion_id,
    usuario,
    responsable_ingenieria,
    justificacion,
    observaciones="",
    documento=None
):
        # 9.8.2 - Validar permisos
    validar_rol(
        usuario,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )


    # Obtener inspección
    inspeccion = (
        InspeccionSDI.objects
        .select_for_update()
        .select_related("item__sdi")
        .get(pk=inspeccion_id)
    )

    # Obtener producto y SDI
    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    # Validaciones
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se puede solicitar una concesión para una SDI cerrada."
        )

    if inspeccion.resultado not in [
        InspeccionSDI.Resultado.RECHAZADA,
        InspeccionSDI.Resultado.PARCIAL,
    ]:
        raise ValidationError(
            "Solo se puede solicitar una concesión para una "
            "inspección rechazada o parcialmente aprobada."
        )
        # 6.1.1 - Validar que sea la última inspección
    ultima_inspeccion = (
        InspeccionSDI.objects
        .filter(item=item)
        .order_by("-numero_inspeccion")
        .first()
    )

    if ultima_inspeccion.id != inspeccion.id:
        raise ValidationError(
            "No se puede solicitar concesión sobre una inspección anterior "
            "que ya fue reemplazada por una reinspección."
        )

    if ConcesionSDI.objects.filter(
        inspeccion=inspeccion,
        decision=ConcesionSDI.Decision.SOLICITADA
    ).exists():
        raise ValidationError(
            "Ya existe una concesión pendiente para esta inspección."
        )

    if not responsable_ingenieria.strip():
        raise ValidationError(
            "Debe indicar el responsable de Ingeniería."
        )

    if not justificacion.strip():
        raise ValidationError(
            "Debe ingresar una justificación para la concesión."
        )

    estado_anterior_sdi = sdi.estado

    # Crear solicitud
    concesion = ConcesionSDI.objects.create(
        inspeccion=inspeccion,
        decision=ConcesionSDI.Decision.SOLICITADA,
        responsable_ingenieria=responsable_ingenieria,
        justificacion=justificacion,
        documento=documento,
        registrado_por=usuario,
        observaciones=observaciones,
    )

    # Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        inspeccion=inspeccion,
        usuario=usuario,
        accion="Concesión solicitada",
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=sdi.estado,
        comentario=(
            f"Se solicitó concesión para la inspección "
            f"#{inspeccion.numero_inspeccion}. "
            f"Responsable de Ingeniería: "
            f"{responsable_ingenieria}."
        ),
    )

    return concesion


# 6.2 - Resolver concesión
@transaction.atomic
def resolver_concesion(
    concesion_id,
    usuario,
    decision,
    observaciones=""
):
        # 9.8.3 - Validar permisos
    validar_rol(
        usuario,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    # Obtener concesión
    concesion = (
        ConcesionSDI.objects
        .select_for_update()
        .select_related("inspeccion__item__sdi")
        .get(pk=concesion_id)
    )

    inspeccion = concesion.inspeccion

    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    # Validaciones
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se puede resolver una concesión de una SDI cerrada."
        )

    if concesion.decision != ConcesionSDI.Decision.SOLICITADA:
        raise ValidationError(
            "La concesión ya fue procesada."
        )

    if decision not in [
        ConcesionSDI.Decision.APROBADA,
        ConcesionSDI.Decision.RECHAZADA,
    ]:
        raise ValidationError(
            "La decisión debe ser aprobada o rechazada."
        )

    estado_anterior_sdi = sdi.estado

    # Guardar decisión
    concesion.decision = decision
    concesion.fecha_decision = timezone.now()
    concesion.observaciones = observaciones

    concesion.save(
        update_fields=[
            "decision",
            "fecha_decision",
            "observaciones",
        ]
    )

    # Concesión aprobada
    if decision == ConcesionSDI.Decision.APROBADA:

        item.resultado_actual = (
            ItemSDI.Resultado.CONCESION
        )

        accion = "Concesión aprobada"

    # Concesión rechazada
    else:

        item.resultado_actual = (
            ItemSDI.Resultado.RECHAZADA
        )

        accion = "Concesión rechazada"

    # Actualizar producto
    item.save(
        update_fields=[
            "resultado_actual",
            "actualizado",
        ]
    )

    # Actualizar SDI
    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

    # Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        inspeccion=inspeccion,
        usuario=usuario,
        accion=accion,
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=nuevo_estado_sdi,
        comentario=(
            f"{accion} para la inspección "
            f"#{inspeccion.numero_inspeccion}. "
            f"Responsable de Ingeniería: "
            f"{concesion.responsable_ingenieria}."
        ),
    )

    return concesion
# =========================================================
# ÍTEM 7 - CERRAR SDI
# =========================================================

@transaction.atomic
def cerrar_sdi(
    sdi_id,
    usuario,
    comentario=""
):
        # 9.8.4 - Validar permisos
    validar_rol(
        usuario,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    # 7.1 - Obtener SDI
    sdi = (
        SDI.objects
        .select_for_update()
        .get(pk=sdi_id)
    )

    # 7.2 - Validar que no esté cerrada
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "La SDI ya se encuentra cerrada o anulada."
        )

    if not sdi.revisada or not sdi.revisada_por_id:
        raise ValidationError("Jefe/Supervisor debe revisar los resultados antes de cerrar la SDI.")
    if InspeccionSDI.objects.filter(item__sdi=sdi, actualizada__gt=sdi.revisada).exists():
        raise ValidationError("Los resultados cambiaron: vuelve a revisarlos antes del cierre.")

    # 7.3 - Obtener productos
    items = list(
        ItemSDI.objects
        .select_for_update()
        .filter(sdi=sdi)
    )

    if not items:
        raise ValidationError(
            "No se puede cerrar una SDI sin productos."
        )

    # 7.4 - Validar productos resueltos
    estados_finales = [
        ItemSDI.Resultado.APROBADA,
        ItemSDI.Resultado.RECHAZADA,
        ItemSDI.Resultado.CONCESION,
    ]

    if any(
        item.resultado_actual not in estados_finales
        for item in items
    ):
        raise ValidationError(
            "No se puede cerrar la SDI porque existen "
            "productos pendientes o en proceso."
        )

    # 7.5 - Validar inspecciones en proceso
    if InspeccionSDI.objects.filter(
        item__sdi=sdi,
        resultado=InspeccionSDI.Resultado.EN_PROCESO
    ).exists():
        raise ValidationError(
            "No se puede cerrar la SDI porque existe "
            "una inspección en proceso."
        )

    # 7.6 - Validar concesiones pendientes
    if ConcesionSDI.objects.filter(
        inspeccion__item__sdi=sdi,
        decision=ConcesionSDI.Decision.SOLICITADA
    ).exists():
        raise ValidationError(
            "No se puede cerrar la SDI porque existe "
            "una concesión pendiente de decisión."
        )

    # 7.7 - Recalcular estado antes del cierre
    recalcular_estado_sdi(sdi, invalidar_revision=False)

    sdi.refresh_from_db()

    estado_anterior_sdi = sdi.estado

    # 7.8 - Cerrar SDI
    sdi.resultado_cierre = sdi.estado
    sdi.estado = SDI.Estado.CERRADA
    sdi.fecha_cierre = timezone.now()

    sdi.save(
        update_fields=[
            "estado",
            "fecha_cierre",
            "resultado_cierre",
            "actualizada",
        ]
    )

    # 7.9 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        usuario=usuario,
        accion="SDI cerrada",
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=SDI.Estado.CERRADA,
        comentario=(
            comentario
            or
            f"La SDI fue cerrada con estado previo "
            f"{estado_anterior_sdi}."
        ),
    )

    from .workflow import queue_notification
    queue_notification(sdi, "cierre")
    return sdi
# =========================================================
# ÍTEM 9 - GESTIÓN DE USUARIOS Y PERMISOS
# =========================================================

@transaction.atomic
def crear_inspector(
    usuario_actual,
    username,
    password,
    first_name="",
    last_name="",
    email="",
    area=None,
):
    # 9.2.1 - Validar permisos
    validar_rol(
        usuario_actual,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    User = get_user_model()

    # 9.2.2 - Validar usuario
    username = username.strip()

    if not username:
        raise ValidationError("El nombre de usuario es obligatorio.")

    if User.objects.filter(username__iexact=username).exists():
        raise ValidationError(
            "Ya existe un usuario con ese nombre."
        )

    # 9.2.3 - Validar contraseña
    validate_password(password)

    # 9.2.4 - Crear usuario
    nuevo_usuario = User.objects.create_user(
        username=username,
        password=password,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        email=email.strip(),
        is_active=True,
    )

    # 9.2.5 - Crear perfil Inspector
    PerfilUsuario.objects.create(
        usuario=nuevo_usuario,
        rol=PerfilUsuario.Rol.INSPECTOR,
        area=area,
        activo=True,
    )

    return nuevo_usuario

# 9.4 - Activar o desactivar Inspector
@transaction.atomic
def cambiar_estado_inspector(
    usuario_actual,
    inspector_id,
    activo,
):
    validar_rol(
        usuario_actual,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    User = get_user_model()

    inspector = User.objects.select_for_update().get(
        pk=inspector_id
    )

    try:
        perfil = PerfilUsuario.objects.select_for_update().get(
            usuario=inspector
        )
    except PerfilUsuario.DoesNotExist:
        raise ValidationError(
            "El usuario no tiene un perfil asignado."
        )

    if perfil.rol != PerfilUsuario.Rol.INSPECTOR:
        raise ValidationError(
            "Solo se puede cambiar el estado de usuarios Inspector."
        )

    inspector.is_active = activo
    inspector.save(update_fields=["is_active"])

    perfil.activo = activo
    perfil.save(update_fields=["activo"])

    return inspector

# 9.5 - Obtener Inspectores activos
def obtener_inspectores_activos(usuario_actual):

    # 9.5.1 - Validar permisos
    validar_rol(
        usuario_actual,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    # 9.5.2 - Obtener Inspectores disponibles
    inspectores = (
        get_user_model()
        .objects
        .filter(
            is_active=True,
            perfil__rol=PerfilUsuario.Rol.INSPECTOR,
            perfil__activo=True,
        )
        .select_related("perfil", "perfil__area")
        .order_by("first_name", "last_name", "username")
    )

    return inspectores
# 10.6.1 - Obtener todos los Inspectores
def obtener_inspectores(usuario_actual):

    validar_rol(
        usuario_actual,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    inspectores = (
        get_user_model()
        .objects
        .filter(
            perfil__rol=PerfilUsuario.Rol.INSPECTOR,
        )
        .select_related(
            "perfil",
            "perfil__area",
        )
        .order_by(
            "first_name",
            "last_name",
            "username",
        )
    )

    return inspectores

# 9.6 - Asignar Inspector a una SDI
@transaction.atomic
def asignar_inspector_sdi(usuario_actual, sdi_id, inspector_id):
    from .workflow import assign_sdi, MANAGEMENT_ROLES, record_event
    validar_rol(usuario_actual, MANAGEMENT_ROLES)
    sdi = SDI.objects.select_for_update().get(pk=sdi_id)
    inspector = get_user_model().objects.select_related("perfil").get(pk=inspector_id)
    if not sdi.asignada:
        return assign_sdi(sdi_id, usuario_actual, inspector, sdi.instrucciones)
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError("No se puede reasignar una SDI cerrada.")
    perfil = getattr(inspector, "perfil", None)
    if not inspector.is_active or not perfil or not perfil.activo or perfil.rol != PerfilUsuario.Rol.INSPECTOR:
        raise ValidationError("Selecciona un inspector activo.")
    anterior = sdi.inspector
    sdi.inspector = inspector
    sdi.save(update_fields=["inspector", "actualizada"])
    InspeccionSDI.objects.filter(item__sdi=sdi, resultado=InspeccionSDI.Resultado.EN_PROCESO).update(inspector=inspector)
    record_event(sdi, usuario_actual, "Inspector reasignado", f"{anterior.username if anterior else 'Sin asignar'} → {inspector.username}")
    return sdi

# =========================================================
# ÍTEM 10.5 - CREAR SDI
# =========================================================

@transaction.atomic
def crear_sdi(
    usuario_actual,
    activacion_proyecto,
    numero_sdi,
    fecha_emision,
    proyecto,
    departamento_solicitante,
    solicitante,
    inspector=None,
    prioridad=SDI.Prioridad.MEDIA,
    observaciones="",
    prefijo_bod=False,
):
    # 10.5.1 - Validar permisos
    validar_rol(
        usuario_actual,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    if inspector is not None:
        raise ValidationError("La asignación se realiza después de revisar la SDI y sus productos.")

    # 10.5.3 - Crear SDI
    sdi = SDI.objects.create(
        prefijo_bod=prefijo_bod,
        activacion_proyecto=activacion_proyecto,
        numero_sdi=numero_sdi,
        fecha_emision=fecha_emision,
        proyecto=proyecto,
        departamento_solicitante=departamento_solicitante,
        solicitante=solicitante,
        inspector=inspector,
        creado_por=usuario_actual,
        prioridad=prioridad,
        observaciones=observaciones,
        estado=SDI.Estado.PENDIENTE,
    )

    # 10.5.4 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        usuario=usuario_actual,
        accion="SDI creada",
        estado_nuevo=SDI.Estado.PENDIENTE,
        comentario=(
            "SDI registrada pendiente de revisión y asignación."
        ),
    )

    return sdi
# =========================================================
# ÍTEM 10.7 - ÍTEMS / PRODUCTOS SDI
# =========================================================

@transaction.atomic
def crear_item_sdi(
    usuario_actual,
    sdi_id,
    orden,
    articulo,
    cantidad_a_inspeccionar,
    codigo_plano="",
    observaciones="",
):
    # 10.7.1 - Validar permisos
    validar_rol(
        usuario_actual,
        [
            PerfilUsuario.Rol.ADMINISTRADOR,
            PerfilUsuario.Rol.JEFE_CALIDAD,
            PerfilUsuario.Rol.SUPERVISOR,
        ],
    )

    # 10.7.2 - Obtener SDI
    sdi = SDI.objects.select_for_update().get(
        pk=sdi_id
    )

    if sdi.asignada:
        raise ValidationError("Los productos se corrigen antes de asignar la SDI.")

    # 10.7.3 - Validar cierre
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se pueden agregar productos a una SDI cerrada."
        )

    # 10.7.4 - Validar orden
    if ItemSDI.objects.filter(
        sdi=sdi,
        orden=orden,
    ).exists():
        raise ValidationError(
            "Ya existe un producto con ese orden en la SDI."
        )

    # 10.7.5 - Crear producto
    item = ItemSDI.objects.create(
        sdi=sdi,
        orden=orden,
        codigo_plano=codigo_plano,
        articulo=articulo,
        cantidad_a_inspeccionar=cantidad_a_inspeccionar,
        unidades_liberadas=0,
        resultado_actual=ItemSDI.Resultado.PENDIENTE,
        observaciones=observaciones,
    )

    # 10.7.6 - Recalcular SDI
    recalcular_estado_sdi(sdi)

    # 10.7.7 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        usuario=usuario_actual,
        accion="Producto agregado",
        estado_nuevo=item.resultado_actual,
        comentario=(
            f"Producto {item.orden} - "
            f"{item.articulo} agregado a la SDI."
        ),
    )

    return item

# =========================================================
# ÍTEM 10.8 - CREAR INSPECCIÓN
# =========================================================

@transaction.atomic
def crear_inspeccion(
    usuario_actual,
    item_id,
    inspector,
    cantidad_inspeccionada,
    observaciones="",
):
    # 10.8.2 - Obtener producto
    item = (
        ItemSDI.objects
        .select_for_update()
        .select_related("sdi")
        .get(pk=item_id)
    )

    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    roles = [PerfilUsuario.Rol.INSPECTOR] if sdi.flujo else [
        PerfilUsuario.Rol.ADMINISTRADOR, PerfilUsuario.Rol.JEFE_CALIDAD,
        PerfilUsuario.Rol.SUPERVISOR,
    ]
    validar_rol(usuario_actual, roles)
    if sdi.flujo and (sdi.inspector_id != usuario_actual.pk or sdi.estado not in (SDI.Estado.EN_PROCESO, SDI.Estado.CORRECCION)):
        raise PermissionDenied("Solo el inspector asignado puede iniciar el intento durante ejecución.")

    if not sdi.asignada or sdi.inspector_id != inspector.id:
        raise ValidationError("La inspección requiere una SDI asignada a ese inspector.")

    # 10.8.3 - Validar SDI
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se puede iniciar una inspección en una SDI cerrada."
        )

    # 10.8.4 - Validar que sea inspección inicial
    if InspeccionSDI.objects.filter(
        item=item
    ).exists():
        raise ValidationError(
            "Este producto ya tiene una inspección. "
            "Debe utilizar el proceso de reinspección."
        )

    # 10.8.5 - Validar Inspector
    try:
        perfil = inspector.perfil
    except PerfilUsuario.DoesNotExist:
        raise ValidationError(
            "El usuario seleccionado no tiene perfil."
        )

    if perfil.rol != PerfilUsuario.Rol.INSPECTOR:
        raise ValidationError(
            "El usuario seleccionado no es Inspector."
        )

    if not inspector.is_active or not perfil.activo:
        raise ValidationError(
            "El Inspector seleccionado está desactivado."
        )

    # 10.8.6 - Validar cantidad
    pendientes = (
        item.cantidad_a_inspeccionar
        - item.unidades_liberadas
    )

    if cantidad_inspeccionada <= 0:
        raise ValidationError(
            "La cantidad a inspeccionar debe ser mayor que cero."
        )

    if cantidad_inspeccionada > pendientes:
        raise ValidationError(
            "La cantidad a inspeccionar supera las unidades pendientes."
        )

    # 10.8.7 - Crear inspección
    estado_anterior_sdi = sdi.estado

    inspeccion = InspeccionSDI.objects.create(
        item=item,
        numero_inspeccion=1,
        inspector=inspector,
        cantidad_inspeccionada=cantidad_inspeccionada,
        cantidad_aprobada=0,
        resultado=InspeccionSDI.Resultado.EN_PROCESO,
        observaciones=observaciones,
    )

    # 10.8.8 - Actualizar producto
    item.resultado_actual = ItemSDI.Resultado.EN_PROCESO
    item.save(
        update_fields=[
            "resultado_actual",
            "actualizado",
        ]
    )

    # 10.8.9 - Recalcular SDI
    recalcular_estado_sdi(sdi)
    sdi.refresh_from_db()

    # 10.8.10 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        inspeccion=inspeccion,
        usuario=usuario_actual,
        accion="Inspección iniciada",
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=sdi.estado,
        comentario=(
            f"Inspección #1 iniciada para "
            f"{item.articulo}. "
            f"Cantidad: {cantidad_inspeccionada}."
        ),
    )

    return inspeccion

# =========================================================
# ÍTEM 10.8 - REGISTRAR INSPECCIÓN VISUAL
# =========================================================

@transaction.atomic
def registrar_inspeccion_visual(
    usuario,
    inspeccion_id,
    rebarbas,
    rayaduras,
    golpes,
    deformidad,
    pintura,
    burbujas,
    planitud,
    observaciones="",
):
    # 10.8.1 - Obtener inspección
    inspeccion = (
        InspeccionSDI.objects
        .select_for_update()
        .select_related(
            "item",
            "item__sdi",
            "inspector",
        )
        .get(pk=inspeccion_id)
    )

    # 10.8.2 - Validar acceso
    validar_acceso_inspeccion(
        usuario,
        inspeccion,
    )

    sdi = inspeccion.item.sdi

    # 10.8.3 - Validar SDI
    if sdi.estado in (SDI.Estado.CERRADA, SDI.Estado.ANULADA):
        raise ValidationError(
            "No se puede registrar una inspección visual "
            "en una SDI cerrada."
        )

    # 10.8.4 - Validar inspección
    if inspeccion.resultado != InspeccionSDI.Resultado.EN_PROCESO:
        raise ValidationError(
            "Solo se puede registrar la inspección visual "
            "en una inspección en proceso."
        )

    # 10.8.5 - Crear o actualizar visual
    visual = InspeccionVisual.objects.filter(
        inspeccion=inspeccion
    ).first()

    accion = (
        "Inspección visual actualizada"
        if visual
        else "Inspección visual registrada"
    )

    if not visual:
        visual = InspeccionVisual(
            inspeccion=inspeccion
        )

    campos_visual = ["rebarbas", "rayaduras", "golpes", "deformidad", "pintura", "burbujas", "planitud", "observaciones"]
    anteriores_visual = {campo: getattr(visual, campo) for campo in campos_visual}

    visual.rebarbas = rebarbas
    visual.rayaduras = rayaduras
    visual.golpes = golpes
    visual.deformidad = deformidad
    visual.pintura = pintura
    visual.burbujas = burbujas
    visual.planitud = planitud
    visual.observaciones = observaciones

    visual.full_clean()
    visual.save()

    cambios_visual = "\n".join(
        f"{campo.capitalize()}: {anteriores_visual[campo] or 'Sin registro'} → {getattr(visual, campo) or 'Sin observaciones'}"
        for campo in campos_visual if anteriores_visual[campo] != getattr(visual, campo)
    )

    # 10.8.6 - Registrar historial
    HistorialSDI.objects.create(
        sdi=sdi,
        item=inspeccion.item,
        inspeccion=inspeccion,
        usuario=usuario,
        accion=accion,
        estado_anterior=inspeccion.resultado,
        estado_nuevo=inspeccion.resultado,
        comentario=(
            f"Resultado visual: "
            f"{visual.resultado_visual}.\n{cambios_visual}"
        ),
    )

    return visual

# =========================================================
# EDICION GENERAL DE USUARIOS
# =========================================================

@transaction.atomic
def editar_usuario(usuario_id, usuario, datos):
    roles_permitidos = obtener_roles_gestionables(usuario)

    objetivo = (
        get_user_model().objects
        .select_for_update()
        .get(pk=usuario_id)
    )

    perfil = (
        PerfilUsuario.objects
        .select_for_update()
        .get(usuario=objetivo)
    )

    if perfil.rol not in roles_permitidos:
        raise PermissionDenied(
            "No tienes permisos para editar este usuario."
        )

    nuevo_rol = datos.get("rol", perfil.rol)


    if nuevo_rol not in roles_permitidos:
        raise PermissionDenied(
            "No tienes permisos para asignar ese rol."
        )


    if objetivo.is_staff or objetivo.is_superuser:
        raise PermissionDenied(
            "Las cuentas de administración de Django "
            "deben gestionarse desde el administrador de Django."
        )

    if objetivo.pk == usuario.pk:
        if nuevo_rol != perfil.rol:
            raise ValidationError(
                "No puedes cambiar tu propio rol."
            )

        if datos.get("activo") is False:
            raise ValidationError(
                "No puedes desactivar tu propia cuenta."
            )



    if "area_id" in datos:
        area_id = datos["area_id"]

        if area_id is None:
            perfil.area = None
        else:
            area = Area.objects.filter(
                pk=area_id,
                activo=True,
            ).first()

            if area is None:
                raise ValidationError({
                    "area_id": "El área no existe o está inactiva."
                })

            perfil.area = area



    campos_usuario = []

    for campo in ("first_name", "last_name", "email"):
        if campo in datos:
            setattr(objetivo, campo, datos[campo])
            campos_usuario.append(campo)

    if "activo" in datos:
        objetivo.is_active = datos["activo"]
        perfil.activo = datos["activo"]
        campos_usuario.append("is_active")

    perfil.rol = nuevo_rol


    objetivo.full_clean()
    perfil.full_clean()

    if campos_usuario:
        objetivo.save(update_fields=campos_usuario)

    perfil.save(
        update_fields=["rol", "area", "activo"],
    )

    LogEntry.objects.log_actions(
        user_id=usuario.pk,
        queryset=[objetivo],
        action_flag=CHANGE,
        change_message=[{"changed": {"fields": sorted(datos)}}],
    )

    return objetivo


# =========================================================
# CREACIÓN GENERAL DE USUARIOS
# =========================================================

@transaction.atomic
def crear_usuario(usuario_actual, datos):
    roles_permitidos = obtener_roles_gestionables(usuario_actual)
    rol = datos["rol"]

    if rol not in roles_permitidos:
        raise PermissionDenied(
            "No tienes permisos para crear usuarios con ese rol."
        )

    User = get_user_model()
    username = datos["username"].strip()

    if User.objects.filter(username__iexact=username).exists():
        raise ValidationError({
            "username": "Ya existe un usuario con ese nombre."
        })

    area = None
    area_id = datos.get("area_id")

    if area_id is not None:
        area = Area.objects.filter(
            pk=area_id,
            activo=True,
        ).first()

        if area is None:
            raise ValidationError({
                "area_id": "El área no existe o está inactiva."
            })

    nuevo_usuario = User(
        username=username,
        first_name=datos.get("first_name", ""),
        last_name=datos.get("last_name", ""),
        email=datos.get("email", ""),
        is_active=datos.get("activo", True),
    )

    validate_password(
        datos["password"],
        user=nuevo_usuario,
    )

    nuevo_usuario.set_password(datos["password"])
    nuevo_usuario.full_clean()
    nuevo_usuario.save()


    PerfilUsuario.objects.create(
        usuario=nuevo_usuario,
        rol=rol,
        area=area,
        activo=nuevo_usuario.is_active,
    )

    LogEntry.objects.log_actions(
        user_id=usuario_actual.pk,
        queryset=[nuevo_usuario],
        action_flag=ADDITION,
        change_message="Usuario creado por API.",
    )


    return nuevo_usuario
