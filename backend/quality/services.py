from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

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
def aprobar_inspeccion(inspeccion_id, usuario):
    """
    Aprueba una inspección solamente si su inspección visual
    se encuentra conforme.
    """

    inspeccion = (
        InspeccionSDI.objects
        .select_for_update()
        .select_related("item__sdi")
        .get(pk=inspeccion_id)
    )

    item = (
        ItemSDI.objects
        .select_for_update()
        .get(pk=inspeccion.item_id)
    )

    sdi = (
        SDI.objects
        .select_for_update()
        .get(pk=item.sdi_id)
    )

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