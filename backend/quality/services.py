# =========================================================
# ÍTEM 1 - IMPORTACIONES
# =========================================================

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.db.models import Max

from .models import (
    SDI,
    ItemSDI,
    InspeccionSDI,
    InspeccionVisual,
    RechazoSDI,
    ConcesionSDI,
    HistorialSDI,

)


# =========================================================
# ÍTEM 2 - RECALCULAR ESTADO DE LA SDI
# =========================================================

def recalcular_estado_sdi(sdi):

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
        nuevo_estado = SDI.Estado.PENDIENTE

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

    # 3.2 - Obtener producto
    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    # 3.3 - Obtener SDI
    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    # 3.4 - Validaciones
    if sdi.estado == SDI.Estado.CERRADA:
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

    # 4.2 - Obtener producto
    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    # 4.3 - Obtener SDI
    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

    # 4.4 - Validaciones
    if sdi.estado == SDI.Estado.CERRADA:
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

    # 5.3 - Validaciones
    if sdi.estado == SDI.Estado.CERRADA:
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
    if sdi.estado == SDI.Estado.CERRADA:
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
    if sdi.estado == SDI.Estado.CERRADA:
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

    # 7.1 - Obtener SDI
    sdi = (
        SDI.objects
        .select_for_update()
        .get(pk=sdi_id)
    )

    # 7.2 - Validar que no esté cerrada
    if sdi.estado == SDI.Estado.CERRADA:
        raise ValidationError(
            "La SDI ya se encuentra cerrada."
        )

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
    recalcular_estado_sdi(sdi)

    sdi.refresh_from_db()

    estado_anterior_sdi = sdi.estado

    # 7.8 - Cerrar SDI
    sdi.estado = SDI.Estado.CERRADA
    sdi.fecha_cierre = timezone.now()

    sdi.save(
        update_fields=[
            "estado",
            "fecha_cierre",
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

    return sdi