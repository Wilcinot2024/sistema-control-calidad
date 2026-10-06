# =========================================================
# ÍTEM 10.3 - SERIALIZERS
# =========================================================

from rest_framework import serializers

from .models import SDI


# =========================================================
# 10.3.1 - SDI
# =========================================================

class SDISerializer(serializers.ModelSerializer):

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
        )

        read_only_fields = (
            "id",
            "codigo_sdi",
            "creado_por",
            "estado",
            "fecha_cierre",
            "creada",
            "actualizada",
        )

    # 10.3.2 - Nombre del Inspector
    def get_inspector_nombre(self, obj):

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