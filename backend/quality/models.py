# Aquí se construyen todas las tablas.
from django.conf import settings
from django.core.validators import RegexValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


# =========================================================
# VALIDADORES
# =========================================================

solo_digitos_proyecto = RegexValidator(
    regex=r"^\d{1,6}$",
    message="El código de proyecto debe contener entre 1 y 6 dígitos."
)

solo_digitos_sdi = RegexValidator(
    regex=r"^\d+$",
    message="El número de SDI debe contener solamente dígitos."
)


# =========================================================
# AREA
# =========================================================

class Area(models.Model):
    nombre = models.CharField(max_length=150, unique=True)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "quality_area"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


# =========================================================
# PERFIL DE USUARIO
# =========================================================

class PerfilUsuario(models.Model):

    class Rol(models.TextChoices):
        ADMINISTRADOR = "administrador", "Administrador"
        SUPERVISOR = "supervisor", "Supervisor"
        JEFE_CALIDAD = "jefe_calidad", "Jefe de Calidad"
        INSPECTOR = "inspector", "Inspector"

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="perfil"
    )

    rol = models.CharField(
        max_length=30,
        choices=Rol.choices
    )

    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="perfiles"
    )

    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "quality_perfilusuario"

    def __str__(self):
        return f"{self.usuario.username} - {self.get_rol_display()}"


# =========================================================
# SDI
# =========================================================

class SDI(models.Model):

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        EN_PROCESO = "en_proceso", "En proceso"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"
        CONCESION = "concesion", "Concesión"
        CERRADA = "cerrada", "Cerrada"

    class Prioridad(models.TextChoices):
        BAJA = "baja", "Baja"
        MEDIA = "media", "Media"
        ALTA = "alta", "Alta"

    prefijo_bod = models.BooleanField(default=False)

    activacion_proyecto = models.CharField(
        max_length=6,
        validators=[solo_digitos_proyecto]
    )

    numero_sdi = models.TextField(
        validators=[solo_digitos_sdi]
    )

    fecha_emision = models.DateField()

    proyecto = models.CharField(max_length=200)

    departamento_solicitante = models.CharField(max_length=150)

    solicitante = models.CharField(max_length=150)

    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sdi_asignadas"
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sdi_creadas"
    )

    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.PENDIENTE
    )

    prioridad = models.CharField(
        max_length=20,
        choices=Prioridad.choices,
        default=Prioridad.MEDIA
    )

    observaciones = models.TextField(blank=True)

    fecha_cierre = models.DateTimeField(
        null=True,
        blank=True
    )

    creada = models.DateTimeField(auto_now_add=True)
    actualizada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quality_sdi"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "prefijo_bod",
                    "activacion_proyecto",
                    "numero_sdi"
                ],
                name="uq_codigo_sdi"
            ),
            models.CheckConstraint(
                condition=Q(
                    activacion_proyecto__regex=r"^\d{1,6}$"
                ),
                name="ck_sdi_proyecto_digitos"
            ),
            models.CheckConstraint(
                condition=Q(
                    numero_sdi__regex=r"^\d+$"
                ),
                name="ck_sdi_numero_digitos"
            ),
        ]

        indexes = [
            models.Index(
                fields=["estado"],
                name="idx_sdi_estado"
            ),
            models.Index(
                fields=["inspector", "estado"],
                name="idx_sdi_insp_estado"
            ),
            models.Index(
                fields=["fecha_emision"],
                name="idx_sdi_fecha"
            ),
        ]

    @property
    def codigo_sdi(self):
        if self.prefijo_bod:
            return (
                f"SDI-BOD-{self.activacion_proyecto}-"
                f"{self.numero_sdi}"
            )

        return (
            f"SDI-{self.activacion_proyecto}-"
            f"{self.numero_sdi}"
        )

    def __str__(self):
        return self.codigo_sdi


# =========================================================
# ITEM / PRODUCTO DE LA SDI
# =========================================================

class ItemSDI(models.Model):

    class Resultado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        EN_PROCESO = "en_proceso", "En proceso"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"
        CONCESION = "concesion", "Concesión"

    sdi = models.ForeignKey(
        SDI,
        on_delete=models.CASCADE,
        related_name="items"
    )

    orden = models.PositiveIntegerField()

    codigo_plano = models.CharField(
        max_length=150,
        null=True,
        blank=True
    )

    articulo = models.CharField(max_length=250)

    cantidad_a_inspeccionar = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    unidades_liberadas = models.PositiveIntegerField(default=0)

    resultado_actual = models.CharField(
        max_length=20,
        choices=Resultado.choices,
        default=Resultado.PENDIENTE
    )

    observaciones = models.TextField(blank=True)

    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quality_itemsdi"

        constraints = [
            models.UniqueConstraint(
                fields=["sdi", "orden"],
                name="uq_sdi_orden"
            ),
            models.CheckConstraint(
                condition=Q(cantidad_a_inspeccionar__gt=0),
                name="ck_item_cantidad_positiva"
            ),
            models.CheckConstraint(
                condition=Q(
                    unidades_liberadas__lte=F(
                        "cantidad_a_inspeccionar"
                    )
                ),
                name="ck_item_unidades_liberadas"
            ),
        ]

        indexes = [
            models.Index(
                fields=["resultado_actual"],
                name="idx_item_resultado"
            ),
        ]

    def __str__(self):
        return (
            f"{self.sdi.codigo_sdi} - "
            f"{self.orden} - {self.articulo}"
        )


# =========================================================
# INSPECCION SDI
# =========================================================

class InspeccionSDI(models.Model):

    class Resultado(models.TextChoices):
        EN_PROCESO = "en_proceso", "En proceso"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"
        CONCESION = "concesion", "Concesión"

    item = models.ForeignKey(
        ItemSDI,
        on_delete=models.CASCADE,
        related_name="inspecciones"
    )

    numero_inspeccion = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inspecciones_realizadas"
    )

    cantidad_inspeccionada = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    resultado = models.CharField(
        max_length=20,
        choices=Resultado.choices,
        default=Resultado.EN_PROCESO
    )

    fecha_inicio = models.DateTimeField(default=timezone.now)

    fecha_fin = models.DateTimeField(
        null=True,
        blank=True
    )

    observaciones = models.TextField(blank=True)

    creada = models.DateTimeField(auto_now_add=True)
    actualizada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quality_inspeccionsdi"

        constraints = [
            models.UniqueConstraint(
                fields=["item", "numero_inspeccion"],
                name="uq_item_numero_inspeccion"
            ),
            models.CheckConstraint(
                condition=Q(cantidad_inspeccionada__gt=0),
                name="ck_inspeccion_cantidad"
            ),
        ]

        indexes = [
            models.Index(
                fields=["inspector", "resultado"],
                name="idx_insp_usuario_result"
            ),
        ]

    def __str__(self):
        return (
            f"{self.item.articulo} - "
            f"Inspección #{self.numero_inspeccion}"
        )


# =========================================================
# INSPECCION VISUAL
# =========================================================

class InspeccionVisual(models.Model):

    class Criterio(models.TextChoices):
        CONFORME = "conforme", "Conforme"
        NO_CONFORME = "no_conforme", "No conforme"
        NO_APLICA = "no_aplica", "No aplica"

    inspeccion = models.OneToOneField(
        InspeccionSDI,
        on_delete=models.CASCADE,
        related_name="inspeccion_visual"
    )

    rebarbas = models.CharField(
        max_length=20,
        choices=Criterio.choices
    )

    rayaduras = models.CharField(
        max_length=20,
        choices=Criterio.choices
    )

    golpes = models.CharField(
        max_length=20,
        choices=Criterio.choices
    )

    deformidad = models.CharField(
        max_length=20,
        choices=Criterio.choices
    )

    pintura = models.CharField(
        max_length=20,
        choices=Criterio.choices
    )

    burbujas = models.CharField(
        max_length=20,
        choices=Criterio.choices
    )

    planitud = models.CharField(
        max_length=20,
        choices=Criterio.choices
    )

    observaciones = models.TextField(blank=True)

    fecha = models.DateTimeField(auto_now_add=True)
    actualizada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quality_inspeccionvisual"

    @property
    def resultado_visual(self):

        criterios = [
            self.rebarbas,
            self.rayaduras,
            self.golpes,
            self.deformidad,
            self.pintura,
            self.burbujas,
            self.planitud,
        ]

        if self.Criterio.NO_CONFORME in criterios:
            return self.Criterio.NO_CONFORME

        return self.Criterio.CONFORME

    def __str__(self):
        return f"Visual - {self.inspeccion}"


# =========================================================
# EVIDENCIA SDI
# =========================================================

class EvidenciaSDI(models.Model):

    class Tipo(models.TextChoices):
        FOTO = "foto", "Foto"
        DOCUMENTO = "documento", "Documento"
        OTRO = "otro", "Otro"

    inspeccion = models.ForeignKey(
        InspeccionSDI,
        on_delete=models.CASCADE,
        related_name="evidencias"
    )

    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices
    )

    archivo = models.FileField(
        upload_to="evidencias_sdi/"
    )

    descripcion = models.TextField(blank=True)

    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evidencias_sdi_subidas"
    )

    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "quality_evidenciasdi"

    def __str__(self):
        return f"Evidencia {self.id} - {self.inspeccion}"


# =========================================================
# RECHAZO SDI
# =========================================================

class RechazoSDI(models.Model):

    class Motivo(models.TextChoices):
        ESTETICO = "estetico", "Defecto estético"
        FUERA_TOLERANCIA = (
            "fuera_tolerancia",
            "Fuera de tolerancia"
        )
        PRODUCTO_NO_DISPONIBLE = (
            "producto_no_disponible",
            "Producto no disponible"
        )
        OTRO = "otro", "Otro"

    inspeccion = models.ForeignKey(
        InspeccionSDI,
        on_delete=models.CASCADE,
        related_name="rechazos"
    )

    motivo = models.CharField(
        max_length=30,
        choices=Motivo.choices
    )

    descripcion = models.TextField()

    cantidad_afectada = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rechazos_sdi_registrados"
    )

    resuelto = models.BooleanField(default=False)

    fecha = models.DateTimeField(auto_now_add=True)

    fecha_resolucion = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        db_table = "quality_rechazosdi"

        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(cantidad_afectada__isnull=True)
                    | Q(cantidad_afectada__gt=0)
                ),
                name="ck_rechazo_cantidad"
            ),
        ]

    def __str__(self):
        return f"Rechazo {self.id} - {self.inspeccion}"


# =========================================================
# CONCESION SDI
# =========================================================

class ConcesionSDI(models.Model):

    class Decision(models.TextChoices):
        SOLICITADA = "solicitada", "Solicitada"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"

    inspeccion = models.ForeignKey(
        InspeccionSDI,
        on_delete=models.CASCADE,
        related_name="concesiones"
    )

    decision = models.CharField(
        max_length=20,
        choices=Decision.choices,
        default=Decision.SOLICITADA
    )

    responsable_ingenieria = models.CharField(
        max_length=150
    )

    justificacion = models.TextField()

    documento = models.FileField(
        upload_to="concesiones_sdi/",
        null=True,
        blank=True
    )

    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="concesiones_sdi_registradas"
    )

    fecha_solicitud = models.DateTimeField(auto_now_add=True)

    fecha_decision = models.DateTimeField(
        null=True,
        blank=True
    )

    observaciones = models.TextField(blank=True)

    class Meta:
        db_table = "quality_concesionsdi"

    def __str__(self):
        return (
            f"Concesión {self.id} - "
            f"{self.get_decision_display()}"
        )


# =========================================================
# HISTORIAL SDI
# =========================================================

class HistorialSDI(models.Model):

    sdi = models.ForeignKey(
        SDI,
        on_delete=models.CASCADE,
        related_name="historial"
    )

    item = models.ForeignKey(
        ItemSDI,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="historial"
    )

    inspeccion = models.ForeignKey(
        InspeccionSDI,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="historial"
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="historial_sdi"
    )

    accion = models.CharField(max_length=150)

    estado_anterior = models.CharField(
        max_length=30,
        null=True,
        blank=True
    )

    estado_nuevo = models.CharField(
        max_length=30,
        null=True,
        blank=True
    )

    comentario = models.TextField(blank=True)

    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "quality_historialsdi"
        ordering = ["-fecha"]

        indexes = [
            models.Index(
                fields=["sdi", "fecha"],
                name="idx_hist_sdi_fecha"
            ),
        ]

    def __str__(self):
        return f"{self.sdi.codigo_sdi} - {self.accion}"
