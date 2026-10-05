
# Registro de las tablas.
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

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


# =========================================================
# =========================================================
# =========================================================
# CONCESIONES SDI
# =========================================================

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
        "ver_evidencia",
    )

    list_filter = (
        "decision",
    )

    search_fields = (
        "responsable_ingenieria",
        "justificacion",
    )

    readonly_fields = (
        "fecha_solicitud",
        "fecha_decision",
        "vista_evidencia",
    )

    # -----------------------------------------------------
    # MOSTRAR ENLACE DE EVIDENCIA EN EL LISTADO
    # -----------------------------------------------------
    @admin.display(description="Evidencia")
    def ver_evidencia(self, obj):

        if obj.documento:
            return format_html(
                '<a href="{}" target="_blank">Ver evidencia</a>',
                obj.documento.url
            )

        return "Sin evidencia"

    # -----------------------------------------------------
    # MOSTRAR EVIDENCIA + FECHA Y HORA
    # -----------------------------------------------------
    @admin.display(description="Vista de evidencia")
    def vista_evidencia(self, obj):

        if not obj.documento:
            return "Sin evidencia adjunta"

        url = obj.documento.url

        fecha_solicitud = timezone.localtime(
            obj.fecha_solicitud
        ).strftime("%d-%m-%Y %H:%M")

        if obj.fecha_decision:
            fecha_decision = timezone.localtime(
                obj.fecha_decision
            ).strftime("%d-%m-%Y %H:%M")
        else:
            fecha_decision = "Pendiente"

        # Evidencia fotográfica
        if url.lower().endswith(
            (".jpg", ".jpeg", ".png", ".webp")
        ):
            return format_html(
                """
                <div>
                    <a href="{}" target="_blank">
                        <img src="{}"
                             style="max-width:500px;
                                    max-height:350px;
                                    object-fit:contain;">
                    </a>

                    <p>
                        <strong>Fecha y hora de solicitud:</strong> {}
                    </p>

                    <p>
                        <strong>Fecha y hora de decisión:</strong> {}
                    </p>
                </div>
                """,
                url,
                url,
                fecha_solicitud,
                fecha_decision
            )

        # PDF u otros documentos
        return format_html(
            """
            <div>
                <a href="{}" target="_blank">
                    Abrir documento
                </a>

                <p>
                    <strong>Fecha y hora de solicitud:</strong> {}
                </p>

                <p>
                    <strong>Fecha y hora de decisión:</strong> {}
                </p>
            </div>
            """,
            url,
            fecha_solicitud,
            fecha_decision
        )

    # -----------------------------------------------------
    # GUARDAR CONCESIÓN
    # -----------------------------------------------------
    def save_model(self, request, obj, form, change):

        # Registrar usuario conectado
        if not obj.registrado_por:
            obj.registrado_por = request.user

        # Registrar fecha y hora de decisión
        if obj.decision in [
            ConcesionSDI.Decision.APROBADA,
            ConcesionSDI.Decision.RECHAZADA,
        ]:
            if not obj.fecha_decision:
                obj.fecha_decision = timezone.now()

        # Si sigue solicitada, no existe decisión final
        else:
            obj.fecha_decision = None

        super().save_model(
            request,
            obj,
            form,
            change
        )