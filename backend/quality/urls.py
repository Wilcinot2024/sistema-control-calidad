# =========================================================
# URLS API QUALITY
# =========================================================

from django.urls import path

from .views import (
    usuario_actual,
    listar_sdi,
    detalle_sdi,
    inspectores_api,
    estado_inspector_api,
    items_sdi_api,
    detalle_item_api,
    inspecciones_item_api,
    detalle_inspeccion_api,
)

urlpatterns = [
    path(
        "me/",
        usuario_actual,
        name="usuario_actual",
    ),

    # =====================================================
    # ÍTEM 10.4 - SDI
    # =====================================================
    path(
        "sdi/",
        listar_sdi,
        name="listar_sdi",
    ),
    path(
        "sdi/<int:sdi_id>/",
        detalle_sdi,
        name="detalle_sdi",
    ),

    path(
    "inspectores/",
    inspectores_api,
    name="inspectores_api",
    ),

    path(
    "inspectores/<int:inspector_id>/estado/",
    estado_inspector_api,
    name="estado_inspector_api",
    ),

    # =========================================================
# ÍTEM 10.7 - ÍTEMS / PRODUCTOS
# =========================================================

    path(
    "sdi/<int:sdi_id>/items/",
    items_sdi_api,
    name="items_sdi_api",
    ),

    path(
    "items/<int:item_id>/",
    detalle_item_api,
    name="detalle_item_api",
    ),

    # =========================================================
# ÍTEM 10.8 - INSPECCIONES
# =========================================================

path(
    "items/<int:item_id>/inspecciones/",
    inspecciones_item_api,
    name="inspecciones_item_api",
),

path(
    "inspecciones/<int:inspeccion_id>/",
    detalle_inspeccion_api,
    name="detalle_inspeccion_api",
),
]