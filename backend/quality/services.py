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
    HistorialSDI,
)


def recalcular_estado_sdi(sdi):
    """
    Calcula el estado actual de una SDI según el estado
    vigente de todos sus productos.
    """

    items = list(sdi.items.all())

    if not items:
        nuevo_estado = SDI.Estado.PENDIENTE

    elif all(
        item.resultado_actual == ItemSDI.Resultado.APROBADA
        for item in items
    ):
        nuevo_estado = SDI.Estado.APROBADA

    elif any(
        item.resultado_actual == ItemSDI.Resultado.RECHAZADA
        for item in items
    ):
        nuevo_estado = SDI.Estado.RECHAZADA

    elif any(
        item.resultado_actual == ItemSDI.Resultado.CONCESION
        for item in items
    ):
        nuevo_estado = SDI.Estado.CONCESION

    elif any(
        item.resultado_actual == ItemSDI.Resultado.EN_PROCESO
        for item in items
    ):
        nuevo_estado = SDI.Estado.EN_PROCESO

    else:
        nuevo_estado = SDI.Estado.PENDIENTE

    if sdi.estado != nuevo_estado:
        sdi.estado = nuevo_estado
        sdi.save(update_fields=["estado", "actualizada"])

    return nuevo_estado


@transaction.atomic
def aprobar_inspeccion(
    inspeccion_id,
    usuario,
    cantidad_aprobada=None
):
    inspeccion = (
        InspeccionSDI.objects
        .select_for_update()
        .select_related("item__sdi")
        .get(pk=inspeccion_id)
    )

    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

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

    try:
        visual = inspeccion.inspeccion_visual
    except InspeccionVisual.DoesNotExist:
        raise ValidationError(
            "La inspección debe tener una inspección visual registrada."
        )

    cantidad_rechazada = (
        inspeccion.cantidad_inspeccionada - cantidad_aprobada
    )

    # Si se aprueba el 100 %, todos los criterios visuales
    # deben estar conformes.
    if (
        cantidad_rechazada == 0
        and visual.resultado_visual
        != InspeccionVisual.Criterio.CONFORME
    ):
        raise ValidationError(
            "No se puede aprobar la totalidad porque existen "
            "criterios visuales no conformes."
        )

    nuevas_unidades_liberadas = (
        item.unidades_liberadas + cantidad_aprobada
    )

    if nuevas_unidades_liberadas > item.cantidad_a_inspeccionar:
        raise ValidationError(
            "Las unidades aprobadas acumuladas no pueden superar "
            "la cantidad total a inspeccionar."
        )

    estado_anterior_sdi = sdi.estado

    inspeccion.cantidad_aprobada = cantidad_aprobada
    inspeccion.fecha_fin = timezone.now()

    # -----------------------------------------------------
    # APROBACIÓN TOTAL
    # -----------------------------------------------------
    if cantidad_aprobada == inspeccion.cantidad_inspeccionada:
        inspeccion.resultado = InspeccionSDI.Resultado.APROBADA
        accion = "Inspección aprobada"

    # -----------------------------------------------------
    # APROBACIÓN PARCIAL
    # -----------------------------------------------------
    elif cantidad_aprobada > 0:
        inspeccion.resultado = InspeccionSDI.Resultado.PARCIAL
        accion = "Inspección parcialmente aprobada"

    # -----------------------------------------------------
    # RECHAZO TOTAL
    # -----------------------------------------------------
    else:
        inspeccion.resultado = InspeccionSDI.Resultado.RECHAZADA
        accion = "Inspección rechazada"

    inspeccion.save(
        update_fields=[
            "cantidad_aprobada",
            "resultado",
            "fecha_fin",
            "actualizada",
        ]
    )

    item.unidades_liberadas = nuevas_unidades_liberadas

    # Si ya se aprobaron todas las unidades del ítem.
    if (
        item.unidades_liberadas
        == item.cantidad_a_inspeccionar
    ):
        item.resultado_actual = ItemSDI.Resultado.APROBADA

    # Si todavía faltan unidades y al menos alguna fue aprobada.
    elif item.unidades_liberadas > 0:
        item.resultado_actual = ItemSDI.Resultado.EN_PROCESO

    # Si no se aprobó ninguna.
    else:
        item.resultado_actual = ItemSDI.Resultado.RECHAZADA

    item.save(
        update_fields=[
            "unidades_liberadas",
            "resultado_actual",
            "actualizado",
        ]
    )

    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

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

    # ---------------------------------------------
    # VALIDACIONES
    # ---------------------------------------------

    if sdi.estado == SDI.Estado.CERRADA:
        raise ValidationError(
            "No se puede aprobar una inspección de una SDI cerrada."
        )

    if inspeccion.resultado != InspeccionSDI.Resultado.EN_PROCESO:
        raise ValidationError(
            "Solo se pueden aprobar inspecciones que estén en proceso."
        )

    try:
        visual = inspeccion.inspeccion_visual
    except InspeccionVisual.DoesNotExist:
        raise ValidationError(
            "La inspección debe tener una inspección visual registrada."
        )

    if visual.resultado_visual != InspeccionVisual.Criterio.CONFORME:
        raise ValidationError(
            "La inspección visual contiene criterios no conformes."
        )

    nuevas_unidades_liberadas = (
        item.unidades_liberadas
        + inspeccion.cantidad_inspeccionada
    )

    if nuevas_unidades_liberadas > item.cantidad_a_inspeccionar:
        raise ValidationError(
            "Las unidades liberadas no pueden superar "
            "la cantidad a inspeccionar."
        )

    estado_anterior_sdi = sdi.estado

    # ---------------------------------------------
    # APROBAR INSPECCIÓN
    # ---------------------------------------------

    inspeccion.resultado = InspeccionSDI.Resultado.APROBADA
    inspeccion.fecha_fin = timezone.now()

    inspeccion.save(
        update_fields=[
            "resultado",
            "fecha_fin",
            "actualizada",
        ]
    )
@transaction.atomic
def rechazar_inspeccion(
    inspeccion_id,
    usuario,
    motivo,
    descripcion,
    cantidad_afectada
):
    inspeccion = (
        InspeccionSDI.objects
        .select_for_update()
        .select_related("item__sdi")
        .get(pk=inspeccion_id)
    )

    item = ItemSDI.objects.select_for_update().get(
        pk=inspeccion.item_id
    )

    sdi = SDI.objects.select_for_update().get(
        pk=item.sdi_id
    )

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
            "La cantidad afectada no puede superar la cantidad inspeccionada."
        )

    estado_anterior_sdi = sdi.estado

    rechazo = RechazoSDI.objects.create(
        inspeccion=inspeccion,
        motivo=motivo,
        descripcion=descripcion,
        cantidad_afectada=cantidad_afectada,
        registrado_por=usuario,
    )

    inspeccion.resultado = InspeccionSDI.Resultado.RECHAZADA
    inspeccion.fecha_fin = timezone.now()

    inspeccion.save(
        update_fields=[
            "resultado",
            "fecha_fin",
            "actualizada",
        ]
    )

    item.resultado_actual = ItemSDI.Resultado.RECHAZADA

    item.save(
        update_fields=[
            "resultado_actual",
            "actualizado",
        ]
    )

    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

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
@transaction.atomic
def crear_reinspeccion(
    item_id,
    inspector,
    usuario,
    cantidad_inspeccionada,
    observaciones=""
):
    item = (
        ItemSDI.objects
        .select_for_update()
        .select_related("sdi")
        .get(pk=item_id)
    )

    sdi = SDI.objects.select_for_update().get(pk=item.sdi_id)

    if sdi.estado == SDI.Estado.CERRADA:
        raise ValidationError(
            "No se puede crear una reinspección para una SDI cerrada."
        )

    if cantidad_inspeccionada <= 0:
        raise ValidationError(
            "La cantidad a reinspeccionar debe ser mayor que cero."
        )

    cantidad_pendiente = (
        item.cantidad_a_inspeccionar - item.unidades_liberadas
    )

    if cantidad_inspeccionada > cantidad_pendiente:
        raise ValidationError(
            "La cantidad a reinspeccionar no puede superar "
            "la cantidad pendiente del ítem."
        )

    if InspeccionSDI.objects.filter(
        item=item,
        resultado=InspeccionSDI.Resultado.EN_PROCESO
    ).exists():
        raise ValidationError(
            "Ya existe una inspección en proceso para este ítem."
        )

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

    max_numero = (
        InspeccionSDI.objects
        .filter(item=item)
        .aggregate(max_numero=Max("numero_inspeccion"))
        ["max_numero"]
    )

    nuevo_numero = (max_numero or 0) + 1
    estado_anterior_sdi = sdi.estado

    nueva_inspeccion = InspeccionSDI.objects.create(
        item=item,
        numero_inspeccion=nuevo_numero,
        inspector=inspector,
        cantidad_inspeccionada=cantidad_inspeccionada,
        resultado=InspeccionSDI.Resultado.EN_PROCESO,
        fecha_inicio=timezone.now(),
        observaciones=observaciones,
    )

    item.resultado_actual = ItemSDI.Resultado.EN_PROCESO
    item.save(
        update_fields=[
            "resultado_actual",
            "actualizado",
        ]
    )

    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

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
    # ---------------------------------------------
    # ACTUALIZAR PRODUCTO
    # ---------------------------------------------

    item.unidades_liberadas = nuevas_unidades_liberadas

    if item.unidades_liberadas == item.cantidad_a_inspeccionar:
        item.resultado_actual = ItemSDI.Resultado.APROBADA
    else:
        item.resultado_actual = ItemSDI.Resultado.EN_PROCESO

    item.save(
        update_fields=[
            "unidades_liberadas",
            "resultado_actual",
            "actualizado",
        ]
    )

    # ---------------------------------------------
    # ACTUALIZAR SDI
    # ---------------------------------------------

    nuevo_estado_sdi = recalcular_estado_sdi(sdi)

    # ---------------------------------------------
    # HISTORIAL
    # ---------------------------------------------

    HistorialSDI.objects.create(
        sdi=sdi,
        item=item,
        inspeccion=inspeccion,
        usuario=usuario,
        accion="Inspección aprobada",
        estado_anterior=estado_anterior_sdi,
        estado_nuevo=nuevo_estado_sdi,
        comentario=(
            f"Inspección #{inspeccion.numero_inspeccion} aprobada. "
            f"Se liberaron {inspeccion.cantidad_inspeccionada} unidades."
        ),
    )

    return inspeccion