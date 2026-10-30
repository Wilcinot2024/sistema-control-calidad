"""Contratos de entrada: los campos del sistema no son editables por el cliente."""

from rest_framework import serializers

from .models import SDI
from .serializers import SDISerializer


class ProductoEntrada(serializers.Serializer):
    articulo = serializers.CharField(max_length=250)
    codigo_plano = serializers.CharField(max_length=150, required=False, allow_blank=True)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    cantidad_indicada = serializers.IntegerField(min_value=1)


class EntradaSDI(serializers.Serializer):
    flujo = serializers.ChoiceField(choices=["A", "B"])
    prefijo_bod = serializers.BooleanField(default=False)
    activacion_proyecto = serializers.RegexField(r"^[0-9]{1,6}$")
    numero_sdi = serializers.RegexField(r"^[0-9]+$")
    fecha_emision = serializers.DateField()
    proyecto = serializers.CharField(max_length=200)
    prioridad = serializers.ChoiceField(choices=SDI.Prioridad.values, default=SDI.Prioridad.MEDIA)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    productos = ProductoEntrada(many=True, allow_empty=False)

    def validate_fecha_emision(self, value):
        return SDISerializer().validate_fecha_emision(value)


class EvaluacionEntrada(serializers.Serializer):
    resultado = serializers.ChoiceField(choices=["aprobada", "rechazada"])
    observaciones = serializers.CharField(allow_blank=False)
    visual = serializers.DictField(child=serializers.ChoiceField(choices=["conforme", "no_conforme", "no_aplica"]))

    def validate_visual(self, value):
        campos = {"rebarbas", "rayaduras", "golpes", "deformidad", "pintura", "burbujas", "planitud"}
        if set(value) != campos:
            raise serializers.ValidationError("Registra explícitamente los siete criterios visuales.")
        return value


class AlcanceEntrada(serializers.Serializer):
    producto = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1)


class AsignacionEntrada(serializers.Serializer):
    inspector = serializers.IntegerField(min_value=1)
    alcances = AlcanceEntrada(many=True, allow_empty=False)
    instrucciones = serializers.CharField(required=False, allow_blank=True)
