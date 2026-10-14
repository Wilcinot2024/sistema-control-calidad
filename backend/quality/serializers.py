# =========================================================
# ÍTEM 10.3 - SERIALIZERS
# =========================================================

from rest_framework import serializers

from .models import (
    Area,
    SDI,
    ItemSDI,
    InspeccionSDI,
    InspeccionVisual,
   ConcesionSDI,
   HistorialSDI,
)


# =========================================================
# 10.3.1 - SDI
# =========================================================

class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = ("id", "nombre", "descripcion", "activo")
        read_only_fields = fields


class InspectorAreaMixin:
    def get_area_inspector(self, obj):
        inspector = obj.sdi.inspector if isinstance(obj, ItemSDI) else obj.inspector
        perfil = getattr(inspector, "perfil", None)
        area = getattr(perfil, "area", None)
        return AreaSerializer(area).data if area else None


class SDISerializer(InspectorAreaMixin, serializers.ModelSerializer):

    area_inspector = serializers.SerializerMethodField()

    codigo_sdi = serializers.CharField(
        read_only=True
    )

    inspector_username = serializers.CharField(
        source="inspector.username",
        read_only=True
    )

    inspector_nombre = serializers.SerializerMethodField()

    creado_por_username = serializers.CharField(
        source="creado_por.username",
        read_only=True
    )

    estado_nombre = serializers.CharField(
        source="get_estado_display",
        read_only=True
    )

    prioridad_nombre = serializers.CharField(
        source="get_prioridad_display",
        read_only=True
    )

    class Meta:
        model = SDI

        fields = (
            "id",
            "codigo_sdi",
            "prefijo_bod",
            "activacion_proyecto",
            "numero_sdi",
            "fecha_emision",
            "proyecto",
            "departamento_solicitante",
            "solicitante",
            "inspector",
            "inspector_username",
            "inspector_nombre",
            "area_inspector",
            "creado_por",
            "creado_por_username",
            "estado",
            "estado_nombre",
            "prioridad",
            "prioridad_nombre",
            "observaciones",
            "fecha_cierre",
            "creada",
            "actualizada",
            "origen", "correo_origen", "asunto_correo", "instrucciones", "asignada", "asignado_por",
            "revisada", "revisada_por", "comentario_revision", "resultado_cierre",
            "anulada", "anulada_por", "motivo_anulacion", "archivada", "archivada_por",
        )

        read_only_fields = (
            "anulada", "anulada_por", "motivo_anulacion", "archivada", "archivada_por",
            "inspector", "origen", "asunto_correo", "asignada", "asignado_por", "revisada", "revisada_por", "comentario_revision", "resultado_cierre",
            "id",
            "codigo_sdi",
            "creado_por",
            "estado",
            "fecha_cierre",
            "creada",
            "actualizada",
        )

    # 10.3.2 - Nombre del Inspector
    def validate_fecha_emision(self, value):
        if value is not None:
            from datetime import date
            from django.utils import timezone
            today = timezone.localdate()
            if not date(today.year - 1, 1, 1) <= value <= today:
                raise serializers.ValidationError("Solo año actual o anterior, hasta hoy.")
        return value

    def get_inspector_nombre(self, obj):

        if obj.inspector is None:
            return "Sin asignar"

        nombre = obj.inspector.get_full_name().strip()

        return nombre or obj.inspector.username

    # =========================================================
# 10.6 - INSPECTORES
# =========================================================

class InspectorSerializer(serializers.Serializer):

    id = serializers.IntegerField(
        read_only=True
    )

    username = serializers.CharField(
        read_only=True
    )

    first_name = serializers.CharField(
        read_only=True
    )

    last_name = serializers.CharField(
        read_only=True
    )

    email = serializers.EmailField(
        read_only=True
    )

    is_active = serializers.BooleanField(
        read_only=True
    )

    rol = serializers.CharField(
        source="perfil.rol",
        read_only=True
    )

    perfil_activo = serializers.BooleanField(
        source="perfil.activo",
        read_only=True
    )

    area = serializers.SerializerMethodField()

    def get_area(self, obj):

        if not obj.perfil.area:
            return None

        return {
            "id": obj.perfil.area.id,
            "nombre": str(obj.perfil.area),
        }


class CrearInspectorSerializer(serializers.Serializer):

    username = serializers.CharField(
        max_length=150
    )

    password = serializers.CharField(
        write_only=True
    )

    first_name = serializers.CharField(
        required=False,
        allow_blank=True
    )

    last_name = serializers.CharField(
        required=False,
        allow_blank=True
    )

    email = serializers.EmailField(
        required=False,
        allow_blank=True
    )

    area_id = serializers.IntegerField(
        required=False,
        allow_null=True
    )
    # 10.6.4 - Cambiar estado de Inspector
class CambiarEstadoInspectorSerializer(serializers.Serializer):

    activo = serializers.BooleanField()

    # =========================================================
# ÍTEM 10.7 - ÍTEMS / PRODUCTOS SDI
# =========================================================

class ItemSDISerializer(InspectorAreaMixin, serializers.ModelSerializer):

    area_inspector = serializers.SerializerMethodField()

    resultado_nombre = serializers.CharField(
        source="get_resultado_actual_display",
        read_only=True
    )

    unidades_restantes = serializers.SerializerMethodField()

    class Meta:
        model = ItemSDI

        fields = (
            "id",
            "sdi",
            "area_inspector",
            "orden",
            "codigo_plano",
            "articulo",
            "descripcion", "cantidad_indicada",
            "cantidad_a_inspeccionar",
            "unidades_liberadas",
            "unidades_restantes",
            "resultado_actual",
            "resultado_nombre",
            "observaciones",
            "creado",
            "actualizado",
        )

        read_only_fields = (
            "orden",
            "id",
            "sdi",
            "unidades_liberadas",
            "resultado_actual",
            "creado",
            "actualizado",
        )

    def validate_articulo(self, value):
        if not value or any(not (c.isalnum() or c.isspace() or c in ".-") for c in value):
            raise serializers.ValidationError("Usa letras, números, espacios, puntos y guiones.")
        return value

    def get_unidades_restantes(self, obj):

        return (
            obj.cantidad_a_inspeccionar
            - obj.unidades_liberadas
        )

    # =========================================================
# ÍTEM 10.8 - INSPECCIONES SDI
# =========================================================

class InspeccionSDISerializer(InspectorAreaMixin, serializers.ModelSerializer):

    area_inspector = serializers.SerializerMethodField()

    codigo_sdi = serializers.CharField(
        source="item.sdi.codigo_sdi",
        read_only=True
    )

    articulo = serializers.CharField(
        source="item.articulo",
        read_only=True
    )

    inspector_username = serializers.CharField(
        source="inspector.username",
        read_only=True
    )

    inspector_nombre = serializers.SerializerMethodField()

    resultado_nombre = serializers.CharField(
        source="get_resultado_display",
        read_only=True
    )

    class Meta:
        model = InspeccionSDI

        fields = (
            "id",
            "item",
            "codigo_sdi",
            "articulo",
            "numero_inspeccion",
            "inspector",
            "inspector_username",
            "inspector_nombre",
            "area_inspector",
            "cantidad_inspeccionada",
            "cantidad_aprobada",
            "resultado",
            "resultado_nombre",
            "fecha_inicio",
            "fecha_fin",
            "observaciones",
            "creada",
            "actualizada",
        )

        read_only_fields = (
            "id",
            "item",
            "numero_inspeccion",
            "cantidad_aprobada",
            "resultado",
            "fecha_inicio",
            "fecha_fin",
            "creada",
            "actualizada",
        )

    def get_inspector_nombre(self, obj):

        nombre = obj.inspector.get_full_name().strip()

        return nombre or obj.inspector.username
    # =========================================================
# ÍTEM 10.8 - INSPECCIÓN VISUAL
# =========================================================

class InspeccionVisualSerializer(serializers.ModelSerializer):

    resultado_visual = serializers.CharField(
        read_only=True
    )

    class Meta:
        model = InspeccionVisual

        fields = (
            "id",
            "inspeccion",
            "rebarbas",
            "rayaduras",
            "golpes",
            "deformidad",
            "pintura",
            "burbujas",
            "planitud",
            "resultado_visual",
            "observaciones",
            "fecha",
            "actualizada",
        )

        read_only_fields = (
            "id",
            "inspeccion",
            "resultado_visual",
            "fecha",
            "actualizada",
        )

        # =========================================================
# 10.8 - APROBAR INSPECCIÓN
# =========================================================

class AprobarInspeccionSerializer(serializers.Serializer):

    cantidad_aprobada = serializers.IntegerField(
        required=False,
        min_value=0,
    )

    # =========================================================
# 10.8 - RECHAZAR INSPECCIÓN
# =========================================================

class RechazarInspeccionSerializer(serializers.Serializer):

    motivo = serializers.CharField(
        max_length=150
    )

    descripcion = serializers.CharField()

    cantidad_afectada = serializers.IntegerField(
        min_value=1
    )
    # =========================================================
# ÍTEM 10.9 - REINSPECCIÓN
# =========================================================

class CrearReinspeccionSerializer(serializers.Serializer):

    inspector = serializers.IntegerField()

    cantidad_inspeccionada = serializers.IntegerField(
        min_value=1
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    # =========================================================
# ÍTEM 10.10 - CONCESIONES
# =========================================================

class ConcesionSDISerializer(serializers.ModelSerializer):

    codigo_sdi = serializers.CharField(
        source="inspeccion.item.sdi.codigo_sdi",
        read_only=True,
    )

    numero_inspeccion = serializers.IntegerField(
        source="inspeccion.numero_inspeccion",
        read_only=True,
    )

    registrado_por_username = serializers.CharField(
        source="registrado_por.username",
        read_only=True,
    )

    decision_nombre = serializers.CharField(
        source="get_decision_display",
        read_only=True,
    )

    class Meta:
        model = ConcesionSDI

        fields = (
            "id",
            "inspeccion",
            "codigo_sdi",
            "numero_inspeccion",
            "decision",
            "decision_nombre",
            "responsable_ingenieria",
            "justificacion",
            "documento",
            "registrado_por",
            "registrado_por_username",
            "observaciones",
            "fecha_decision",
        )

        read_only_fields = fields


class SolicitarConcesionSerializer(serializers.Serializer):

    responsable_ingenieria = serializers.CharField(
        max_length=150
    )

    justificacion = serializers.CharField()

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    documento = serializers.FileField(
        required=False,
        allow_null=True,
    )


class ResolverConcesionSerializer(serializers.Serializer):

    decision = serializers.ChoiceField(
        choices=[
            ConcesionSDI.Decision.APROBADA,
            ConcesionSDI.Decision.RECHAZADA,
        ]
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    # =========================================================
# ÍTEM 10.11 - CIERRE DE SDI
# =========================================================

class CerrarSDISerializer(serializers.Serializer):

    comentario = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    # =========================================================
# ÍTEM 10.12 - HISTORIAL DE SDI
# =========================================================

class HistorialSDISerializer(serializers.ModelSerializer):

    usuario_username = serializers.CharField(
        source="usuario.username",
        read_only=True,
    )

    class Meta:
        model = HistorialSDI

        fields = (
            "id",
            "sdi",
            "item",
            "inspeccion",
            "usuario",
            "usuario_username",
            "accion",
            "estado_anterior",
            "estado_nuevo",
            "comentario",
            "fecha",
        )

        read_only_fields = fields
