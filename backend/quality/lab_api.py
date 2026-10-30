"""Adaptador HTTP del laboratorio; las decisiones de negocio viven en flow_*.

Este URLConf sustituye al operativo únicamente con config.lab_settings.
"""

import hashlib
import json
from functools import wraps
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.http import FileResponse
from django.urls import path
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from . import flow_services as flujo
from .flow_access import RESPONSABLES, capacidades, perfil_activo, responsable, visibles
from .flow_notifications import capturar_pendientes
from .flow_pdf import propuesta
from .flow_serializers import AsignacionEntrada, EntradaSDI, EvaluacionEntrada
from .models import AvisoSDI, DocumentoSDI, PerfilUsuario, SDI
from .serializers import HistorialSDISerializer, SDISerializer


def protegida(methods):
    def decorar(fn):
        @wraps(fn)
        def ejecutar(request, *args, **kwargs):
            if not getattr(settings, "LAB_ENABLED", False):
                raise NotFound()
            try:
                perfil_activo(request.user)
                return fn(request, *args, **kwargs)
            except DjangoPermissionDenied as exc:
                raise PermissionDenied(str(exc))
            except DjangoValidationError as exc:
                raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
            except ObjectDoesNotExist:
                raise NotFound("Registro no disponible para esta cuenta.")
            except IntegrityError:
                # No revela propietario ni detalles de una solicitud ajena.
                raise ValidationError("El código de SDI ya existe. Consulta la existente si tienes acceso o contacta a Calidad.")
        return api_view(methods)(ejecutar)
    return decorar


def sesion(user):
    perfil = perfil_activo(user)
    return {
        "id": user.pk, "username": user.username,
        "nombre": user.get_full_name() or user.username, "rol": perfil.rol,
        "rol_nombre": perfil.get_rol_display(),
        "departamento": perfil.departamento.nombre if perfil.departamento_id else None,
    }


def detalle(sdi, user):
    data = dict(SDISerializer(sdi).data)
    data.update(
        flujo=sdi.flujo, version_flujo=sdi.version_flujo, paso_flujo=sdi.paso_flujo,
        solicitud_info=sdi.solicitud_info, iniciada=sdi.iniciada,
        resultado=flujo.resultado_global(sdi), definitivo=sdi.estado == SDI.Estado.CERRADA,
        capacidades=capacidades(user, sdi), cierre_detalle=sdi.cierre_detalle,
    )
    data["productos"] = flujo.detalle_productos(sdi)
    data["historial"] = HistorialSDISerializer(sdi.historial.select_related("usuario"), many=True).data
    data["documentos"] = [{"id": p.pk, "nombre": p.nombre, "url": f"/api/lab/documentos/{p.pk}/"} for p in sdi.documentos.all()]
    if user.perfil.rol in RESPONSABLES:
        data["correos"] = list(sdi.notificaciones.order_by("creada").values(
            "id", "evento", "ocurrencia", "destinatario", "asunto", "mensaje", "capturada", "enviada", "error", "intentos",
        ))
    return data


@protegida(["GET"])
def me(request):
    return Response(sesion(request.user))


@protegida(["GET"])
def configuracion(request):
    cuentas = list(PerfilUsuario.objects.filter(usuario__username__startswith="lab.", activo=True, usuario__is_active=True)
                   .values("usuario__username", "rol"))
    inspectores = list(get_user_model().objects.filter(perfil__rol="inspector", perfil__activo=True, is_active=True)
                       .values("id", "username", "first_name", "last_name")) if request.user.perfil.rol in RESPONSABLES else []
    return Response({
        "cuentas": cuentas, "inspectores": inspectores,
        "base": "PostgreSQL" if "postgresql" in settings.DATABASES["default"]["ENGINE"] else "SQLite (respaldo; sin validación de concurrencia PostgreSQL)",
        "correo": "Captura local; no se envían correos reales",
        "pendientes": ["P-01: administración de cuentas Solicitante", "Excepciones completas: devolución, concesión, reinspección y correctiva", "Conexión Outlook real"],
    })


@protegida(["GET", "POST"])
def solicitudes(request):
    if request.method == "GET":
        return Response([detalle(s, request.user) for s in visibles(request.user).select_related("inspector").order_by("-creada")])
    entrada = request.data
    if "datos" in request.data:
        try:
            entrada = json.loads(request.data["datos"])
        except (TypeError, ValueError):
            raise ValidationError("Datos del formulario no válidos.")
    serializer = EntradaSDI(data=entrada)
    serializer.is_valid(raise_exception=True)
    archivo = request.FILES.get("archivo")
    contenido = None
    if archivo:
        contenido = leer_pdf(archivo)
        propuesta(contenido)  # La extracción incompleta no impide completar manualmente.
    with transaction.atomic():
        sdi = flujo.registrar(request.user, dict(serializer.validated_data))
        if archivo:
            digest = hashlib.sha256(contenido).hexdigest()
            DocumentoSDI.objects.create(sdi=sdi, nombre=Path(archivo.name).name[:250], sha256=digest,
                                       archivo=ContentFile(contenido, name=digest + ".pdf"))
            sdi.origen = "archivo"
            sdi.save(update_fields=["origen"])
    return Response(detalle(sdi, request.user), status=201)


def leer_pdf(archivo):
    if archivo.size > 20 * 1024 * 1024:
        raise ValidationError("El PDF debe tener hasta 20 MB.")
    return archivo.read()


@protegida(["POST"])
def preview(request):
    if request.user.perfil.rol != "solicitante":
        raise PermissionDenied("La vista previa corresponde al registro del solicitante.")
    archivo = request.FILES.get("archivo")
    if not archivo:
        raise ValidationError("Selecciona un PDF.")
    return Response(propuesta(leer_pdf(archivo)))


@protegida(["GET"])
def solicitud(request, sdi_id):
    return Response(detalle(visibles(request.user).get(pk=sdi_id), request.user))


def texto(request, campo):
    from rest_framework import serializers
    return serializers.CharField(max_length=3000).run_validation(request.data.get(campo))


@protegida(["POST"])
def accion(request, sdi_id, nombre):
    if nombre == "asignar":
        entrada = AsignacionEntrada(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        sdi = flujo.asignar(request.user, sdi_id, datos["inspector"], datos["alcances"], datos.get("instrucciones", ""))
    elif nombre == "iniciar":
        sdi = flujo.iniciar(request.user, sdi_id)
    elif nombre == "revision":
        sdi = flujo.enviar_revision(request.user, sdi_id)
    elif nombre == "cerrar":
        sdi = flujo.cerrar(request.user, sdi_id, texto(request, "comentario"))
    elif nombre == "informacion":
        sdi = flujo.pedir_informacion(request.user, sdi_id, texto(request, "motivo"))
    elif nombre == "completar":
        sdi = flujo.completar(request.user, sdi_id, texto(request, "respuesta"))
    else:
        raise NotFound("Acción no disponible en esta primera entrega.")
    return Response(detalle(sdi, request.user))


@protegida(["POST"])
def evaluacion(request, sdi_id, producto_id):
    entrada = EvaluacionEntrada(data=request.data)
    entrada.is_valid(raise_exception=True)
    sdi = flujo.evaluar(request.user, sdi_id, producto_id, **entrada.validated_data)
    return Response(detalle(sdi, request.user))


@protegida(["GET"])
def avisos(request):
    query = AvisoSDI.objects.filter(usuario=request.user, sdi__in=visibles(request.user)).order_by("-creada")
    return Response(list(query.values("id", "sdi_id", "evento", "mensaje", "creada", "leida")))


@protegida(["POST"])
def leer_aviso(request, aviso_id):
    aviso = AvisoSDI.objects.get(pk=aviso_id, usuario=request.user, sdi__in=visibles(request.user))
    if not aviso.leida:
        aviso.leida = timezone.now()
        aviso.save(update_fields=["leida"])
    return Response({"leida": aviso.leida})


@protegida(["POST"])
def captura(request):
    responsable(request.user)
    return Response({"capturados": capturar_pendientes()})


@protegida(["GET"])
def documento(request, documento_id):
    doc = DocumentoSDI.objects.get(pk=documento_id, sdi__in=visibles(request.user))
    return FileResponse(doc.archivo.open("rb"), as_attachment=True, filename=doc.nombre, content_type="application/pdf")


urlpatterns = [
    path("me/", me), path("lab/config/", configuracion),
    path("lab/sdi/", solicitudes), path("lab/preview/", preview),
    path("lab/sdi/<int:sdi_id>/", solicitud),
    path("lab/sdi/<int:sdi_id>/productos/<int:producto_id>/evaluar/", evaluacion),
    path("lab/sdi/<int:sdi_id>/<str:nombre>/", accion),
    path("lab/avisos/", avisos), path("lab/avisos/<int:aviso_id>/leer/", leer_aviso),
    path("lab/capturar/", captura), path("lab/documentos/<int:documento_id>/", documento),
]
