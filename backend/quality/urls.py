# =========================================================
# URLS API QUALITY
# =========================================================

from django.urls import path

from .views import (
    usuario_actual,
    listar_sdi,
    detalle_sdi,
    inspectores_api,
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
]