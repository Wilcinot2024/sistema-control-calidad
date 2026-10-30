"""Operaciones del recorrido SDI. Las reglas A/B comparten datos y servicios."""

import json

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from .flow_access import EJECUCION, RESPONSABLES, entrada_editable, inspector_asignado, perfil_activo, responsable, visibles
from .flow_notifications import emitir
from .models import ConcesionSDI, HistorialSDI, InspeccionSDI, ItemSDI, SDI
from .services import aprobar_inspeccion, crear_inspeccion, rechazar_inspeccion, registrar_inspeccion_visual
from .workflow import record_event

User = get_user_model()


def bloquear(user, sdi_id):
    # La autorización precede al bloqueo y se repite sobre el registro vigente.
    sdi = visibles(user).select_for_update().get(pk=sdi_id)
    return sdi


def detalle_productos(sdi):
    return list(sdi.items.order_by("orden").values(
        "id", "orden", "articulo", "cantidad_indicada", "cantidad_a_inspeccionar",
        "unidades_liberadas", "resultado_actual", "observaciones",
    ))


def resultado_global(sdi):
    resultados = list(sdi.items.values_list("resultado_actual", flat=True))
    if not resultados or any(r not in ("aprobada", "rechazada", "concesion") for r in resultados):
        return "sin_evaluar"
    if "rechazada" in resultados:
        return "rechazada"
    if "concesion" in resultados:
        return "concesion"
    return "aprobada"


def trabajo_completo(sdi):
    if resultado_global(sdi) == "sin_evaluar":
        raise ValidationError("Termina todos los productos antes de enviar la SDI a revisión.")
    if InspeccionSDI.objects.filter(item__sdi=sdi, resultado="en_proceso").exists():
        raise ValidationError("Hay inspecciones abiertas.")
    if ConcesionSDI.objects.filter(inspeccion__item__sdi=sdi, decision="solicitada").exists():
        raise ValidationError("Hay concesiones pendientes de resolución.")


@transaction.atomic
def registrar(user, datos):
    perfil = perfil_activo(user)
    if perfil.rol != "solicitante" or not perfil.departamento_id:
        raise PermissionDenied("Se requiere una cuenta Solicitante con departamento configurado.")
    productos = datos.pop("productos")
    sdi = SDI.objects.create(
        **datos, creado_por=user, departamento_solicitante=perfil.departamento.nombre,
        solicitante=user.get_full_name() or user.username,
        correo_origen=perfil.departamento.correo,
    )
    for orden, producto in enumerate(productos, start=1):
        # Cantidad provisional de entrada: Calidad confirma el alcance al asignar.
        ItemSDI.objects.create(sdi=sdi, orden=orden, cantidad_a_inspeccionar=producto["cantidad_indicada"], **producto)
    record_event(sdi, user, "SDI registrada", "Datos confirmados por el solicitante. Pendiente de asignación.")
    emitir(sdi, "alta", f"Nueva solicitud {sdi.codigo_sdi}, de {sdi.departamento_solicitante}.")
    return sdi


@transaction.atomic
def asignar(user, sdi_id, inspector_id, alcances, instrucciones=""):
    responsable(user)
    sdi = bloquear(user, sdi_id)
    if sdi.asignada and sdi.inspector_id == inspector_id:
        return sdi
    if sdi.asignada or sdi.estado != SDI.Estado.PENDIENTE or sdi.solicitud_info:
        raise ValidationError("Completa la información requerida antes de asignar una SDI pendiente.")
    inspector = User.objects.select_related("perfil").get(pk=inspector_id)
    if perfil_activo(inspector).rol != "inspector":
        raise ValidationError("Selecciona una cuenta Inspector activa.")
    items = list(sdi.items.select_for_update())
    cantidades = {p["producto"]: p["cantidad"] for p in alcances}
    if len(cantidades) != len(alcances) or set(cantidades) != {p.pk for p in items}:
        raise ValidationError("Confirma una vez el alcance de cada producto de esta SDI.")
    for item in items:
        if cantidades[item.pk] > item.cantidad_indicada:
            raise ValidationError("El alcance no puede superar la cantidad declarada.")
        item.cantidad_a_inspeccionar = cantidades[item.pk]
        item.save(update_fields=["cantidad_a_inspeccionar", "actualizado"])
    anterior = sdi.estado
    sdi.inspector = inspector
    sdi.asignada = timezone.now()
    sdi.asignado_por = user
    sdi.instrucciones = instrucciones
    sdi.estado = SDI.Estado.ASIGNADA if sdi.flujo == "B" else SDI.Estado.PENDIENTE
    sdi.save()
    record_event(sdi, user, "Inspector asignado", f"{inspector.username}. Alcances: {cantidades}", anterior)
    emitir(sdi, "asignacion", f"Recibiste la SDI {sdi.codigo_sdi}. {instrucciones}")
    return sdi


@transaction.atomic
def iniciar(user, sdi_id):
    sdi = bloquear(user, sdi_id)
    inspector_asignado(user, sdi)
    if sdi.iniciada:
        return sdi
    esperado = SDI.Estado.ASIGNADA if sdi.flujo == "B" else SDI.Estado.PENDIENTE
    if sdi.estado != esperado or not sdi.asignada:
        raise ValidationError("La SDI debe estar asignada y pendiente de inicio.")
    anterior = sdi.estado
    sdi.estado = SDI.Estado.EN_PROCESO
    sdi.iniciada = timezone.now()
    sdi.save()
    # La creación de intentos reutiliza las validaciones existentes y conserva
    # al inspector que inició el trabajo, aunque el asignador ya esté inactivo.
    for item in sdi.items.all():
        crear_inspeccion(user, item.pk, user, item.cantidad_a_inspeccionar, sdi.instrucciones)
    record_event(sdi, user, "Inicio efectivo", "El inspector asignado inició el trabajo.", anterior)
    emitir(sdi, "inicio", f"La SDI {sdi.codigo_sdi} está en proceso. Inspector: {user.get_full_name() or user.username}.")
    return sdi


@transaction.atomic
def evaluar(user, sdi_id, producto_id, resultado, observaciones, visual):
    sdi = bloquear(user, sdi_id)
    inspector_asignado(user, sdi)
    if sdi.estado not in EJECUCION:
        raise ValidationError("El inspector solo registra resultados durante ejecución o corrección.")
    item = sdi.items.select_for_update().get(pk=producto_id)
    inspeccion = item.inspecciones.select_for_update().latest("numero_inspeccion")
    if inspeccion.resultado != "en_proceso":
        if inspeccion.resultado == resultado and item.observaciones == observaciones:
            return sdi
        raise ValidationError("Este intento ya está evaluado; su corrección requiere el recorrido de corrección con historial.")
    registrar_inspeccion_visual(user, inspeccion.pk, **visual, observaciones=observaciones)
    if resultado == "aprobada":
        aprobar_inspeccion(inspeccion.pk, user)
    else:
        from .models import RechazoSDI
        rechazar_inspeccion(inspeccion.pk, user, RechazoSDI.Motivo.OTRO, observaciones, inspeccion.cantidad_inspeccionada)
    item.refresh_from_db()
    item.observaciones = observaciones
    item.save(update_fields=["observaciones", "actualizado"])
    sdi.paso_flujo += 1
    sdi.save(update_fields=["paso_flujo", "actualizada"])
    return sdi


@transaction.atomic
def enviar_revision(user, sdi_id):
    sdi = bloquear(user, sdi_id)
    inspector_asignado(user, sdi)
    if sdi.estado == SDI.Estado.REVISION:
        return sdi
    if sdi.estado not in EJECUCION:
        raise ValidationError("La SDI no está en ejecución o corrección.")
    trabajo_completo(sdi)
    anterior = sdi.estado
    sdi.estado = SDI.Estado.REVISION
    sdi.save()
    record_event(sdi, user, "Enviada a revisión", "Trabajo completo; evaluación provisional pendiente de validación.", anterior)
    emitir(sdi, "revision", f"La SDI {sdi.codigo_sdi} requiere revisión y confirmación de Calidad.")
    return sdi


@transaction.atomic
def cerrar(user, sdi_id, comentario):
    responsable(user)
    sdi = bloquear(user, sdi_id)
    if sdi.estado == SDI.Estado.CERRADA:
        return sdi
    if sdi.estado != SDI.Estado.REVISION:
        raise ValidationError("Solo se confirma y cierra una SDI pendiente de revisión.")
    trabajo_completo(sdi)
    anterior = sdi.estado
    sdi.revisada = timezone.now()
    sdi.revisada_por = user
    sdi.comentario_revision = comentario
    sdi.resultado_cierre = resultado_global(sdi)
    sdi.cierre_detalle = {"resultado": sdi.resultado_cierre, "productos": detalle_productos(sdi), "responsable": user.pk}
    sdi.estado = SDI.Estado.CERRADA
    sdi.fecha_cierre = sdi.revisada
    sdi.save()
    record_event(sdi, user, "Revisión confirmada y SDI cerrada", comentario, anterior)
    mensaje = f"Resultado confirmado: {sdi.resultado_cierre}.\n" + json.dumps(sdi.cierre_detalle, ensure_ascii=False, indent=2)
    emitir(sdi, "cierre", mensaje)
    return sdi


@transaction.atomic
def pedir_informacion(user, sdi_id, motivo):
    responsable(user)
    sdi = bloquear(user, sdi_id)
    if sdi.asignada or sdi.estado not in (SDI.Estado.PENDIENTE, SDI.Estado.INFORMACION):
        raise ValidationError("Pide información antes de asignar.")
    if sdi.solicitud_info == motivo:
        return sdi
    anterior = sdi.estado
    sdi.solicitud_info = motivo
    sdi.estado = SDI.Estado.INFORMACION if sdi.flujo == "B" else SDI.Estado.PENDIENTE
    sdi.save()
    record_event(sdi, user, "Información requerida", motivo, anterior)
    emitir(sdi, "informacion", f"Completa información de {sdi.codigo_sdi}: {motivo}")
    return sdi


@transaction.atomic
def completar(user, sdi_id, respuesta):
    sdi = bloquear(user, sdi_id)
    entrada_editable(user, sdi)
    if not sdi.solicitud_info:
        raise ValidationError("No existe un requerimiento de información pendiente.")
    anterior = sdi.estado
    sdi.observaciones = f"{sdi.observaciones}\nRespuesta: {respuesta}".strip()
    sdi.solicitud_info = ""
    sdi.estado = SDI.Estado.PENDIENTE
    sdi.paso_flujo += 1
    sdi.save()
    record_event(sdi, user, "Información completada", respuesta, anterior)
    return sdi
