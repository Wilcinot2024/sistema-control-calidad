
# Registro de las tablas.
from django.contrib import admin

from .models import (
    Area,
    PerfilUsuario,
    SDI,
    ItemSDI,
    InspeccionSDI,
    InspeccionVisual,
    EvidenciaSDI,
    RechazoSDI,
    ConcesionSDI,
    HistorialSDI,
)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "activo")
    search_fields = ("nombre",)


@admin.register(PerfilUsuario)
class PerfilUsuarioAdmin(admin.ModelAdmin):
    list_display = ("id", "usuario", "rol", "area", "activo")
    list_filter = ("rol", "area", "activo")
    search_fields = ("usuario__username",)


@admin.register(SDI)
class SDIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "codigo_sdi",
        "proyecto",
        "inspector",
        "estado",
        "prioridad",
        "fecha_emision",
    )

    list_filter = (
        "estado",
        "prioridad",
        "prefijo_bod",
        "fecha_emision",
    )

    search_fields = (
        "activacion_proyecto",
        "numero_sdi",
        "proyecto",
        "solicitante",
        "inspector__username",
    )


@admin.register(ItemSDI)
class ItemSDIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "sdi",
        "orden",
        "articulo",
        "cantidad_a_inspeccionar",
        "unidades_liberadas",
        "resultado_actual",
    )

    list_filter = ("resultado_actual",)

    search_fields = (
        "articulo",
        "codigo_plano",
        "sdi__numero_sdi",
    )


@admin.register(InspeccionSDI)
class InspeccionSDIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "item",
        "numero_inspeccion",
        "inspector",
        "cantidad_inspeccionada",
        "resultado",
        "fecha_inicio",
        "fecha_fin",
    )

    list_filter = ("resultado", "inspector")

    search_fields = (
        "item__articulo",
        "inspector__username",
    )


@admin.register(InspeccionVisual)
class InspeccionVisualAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "inspeccion",
        "rebarbas",
        "rayaduras",
        "golpes",
        "deformidad",
        "pintura",
        "burbujas",
        "planitud",
    )


@admin.register(EvidenciaSDI)
class EvidenciaSDIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "inspeccion",
        "tipo",
        "subido_por",
        "fecha",
    )

    list_filter = ("tipo",)


@admin.register(RechazoSDI)
class RechazoSDIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "inspeccion",
        "motivo",
        "cantidad_afectada",
        "registrado_por",
        "resuelto",
        "fecha",
    )

    list_filter = ("motivo", "resuelto")


@admin.register(ConcesionSDI)
class ConcesionSDIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "inspeccion",
        "decision",
        "responsable_ingenieria",
        "registrado_por",
        "fecha_solicitud",
        "fecha_decision",
    )

    list_filter = ("decision",)


@admin.register(HistorialSDI)
class HistorialSDIAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "sdi",
        "accion",
        "usuario",
        "estado_anterior",
        "estado_nuevo",
        "fecha",
    )

    list_filter = ("fecha",)

    search_fields = (
        "accion",
        "comentario",
        "sdi__numero_sdi",
    )