from functools import wraps
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as ModelValidationError, ObjectDoesNotExist
from django.db import transaction, IntegrityError
from django.db.models import Max
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import SDI, ItemSDI, InspeccionSDI, DocumentoSDI, EvidenciaSDI, PerfilUsuario
from .serializers import SDISerializer, ItemSDISerializer, InspeccionSDISerializer, InspeccionVisualSerializer, HistorialSDISerializer
from .permissions import validar_rol, validar_acceso_inspeccion
from .workflow import MANAGEMENT_ROLES, visible_sdis, receive_pdf, assign_sdi, review_results, record_event, annul_sdi, archive_sdi


def protected(methods):
    def decorate(fn):
        @wraps(fn)
        def handle(*args, **kwargs):
            try:
                return fn(*args, **kwargs)
            except ModelValidationError as exc:
                raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
            except IntegrityError:
                raise ValidationError("Ya existe una SDI con ese código o un producto con ese orden.")
            except ObjectDoesNotExist:
                raise NotFound("No se encontró el registro.")
        return api_view(methods)(authentication_classes([JWTAuthentication])(permission_classes([IsAuthenticated])(handle)))
    return decorate


def inspection_for(user, pk):
    inspection = get_object_or_404(InspeccionSDI.objects.select_related("item__sdi", "inspector"), pk=pk, item__sdi__in=visible_sdis(user))
    validar_acceso_inspeccion(user, inspection)
    return inspection


def evidence_data(evidence):
    return {"id": evidence.id, "nombre": evidence.archivo.name.rsplit("/", 1)[-1], "tipo": evidence.tipo, "descripcion": evidence.descripcion, "archivo": f"/api/evidencias/{evidence.id}/archivo/"}


def changes_comment(instance, fields):
    def display(value):
        if value is None or value == "":
            return "Sin indicar"
        if isinstance(value, bool):
            return "Sí" if value else "No"
        return str(value)
    changes = [f"{field.replace('_', ' ').capitalize()}: {display(getattr(instance, field))} → {display(value)}"
               for field, value in fields.items() if getattr(instance, field) != value]
    return "\n".join(changes) if changes else "Datos confirmados sin cambios."


def detail_data(sdi):
    data = dict(SDISerializer(sdi).data)
    data["datos_pdf"] = sdi.datos_pdf
    data["texto_pdf"] = sdi.texto_pdf
    data["documentos"] = [{"id": doc.id, "nombre": doc.nombre, "archivo": f"/api/documentos/{doc.id}/archivo/"} for doc in sdi.documentos.all()]
    products = []
    for item in sdi.items.select_related("sdi__inspector__perfil__area").order_by("orden"):
        product = dict(ItemSDISerializer(item).data)
        inspections = []
        for inspection in item.inspecciones.select_related("inspector__perfil__area").order_by("numero_inspeccion"):
            payload = dict(InspeccionSDISerializer(inspection).data)
            visual = getattr(inspection, "inspeccion_visual", None)
            payload["visual"] = InspeccionVisualSerializer(visual).data if visual else None
            payload["evidencias"] = [evidence_data(e) for e in inspection.evidencias.all()]
            payload["concesiones"] = [{"id": c.id, "decision": c.decision, "justificacion": c.justificacion, "responsable_ingenieria": c.responsable_ingenieria} for c in inspection.concesiones.all()]
            inspections.append(payload)
        product["inspecciones"] = inspections
        products.append(product)
    data["productos"] = products
    data["historial"] = HistorialSDISerializer(sdi.historial.select_related("usuario"), many=True).data
    data["notificaciones"] = [{"evento": n.evento, "destinatario": n.destinatario, "enviada": n.enviada, "intentos": n.intentos, "error": n.error} for n in sdi.notificaciones.all()]
    return data


@protected(["GET", "POST"])
def sdis(request):
    if request.method == "GET":
        records = visible_sdis(request.user)
        view = request.query_params.get("vista", "activas")
        if view == "activas":
            records = records.filter(archivada__isnull=True).exclude(estado=SDI.Estado.ANULADA)
        elif view == "archivadas":
            records = records.filter(archivada__isnull=False)
        elif view == "anuladas":
            records = records.filter(estado=SDI.Estado.ANULADA, archivada__isnull=True)
        elif view != "todas":
            raise ValidationError("Vista inválida: activas, archivadas, anuladas o todas.")
        return Response(SDISerializer(records, many=True).data)
    validar_rol(request.user, MANAGEMENT_ROLES)
    if request.data.get("inspector"):
        raise ValidationError("Selecciona el inspector en la acción Asignar, después de revisar los productos.")
    serializer = SDISerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        sdi = serializer.save(creado_por=request.user, inspector=None, estado=SDI.Estado.PENDIENTE)
        record_event(sdi, request.user, "SDI registrada", "Pendiente de revisión y asignación.")
    return Response(detail_data(sdi), status=201)


@protected(["GET", "PATCH"])
def sdi_detail(request, sdi_id):
    sdi = get_object_or_404(visible_sdis(request.user), pk=sdi_id)
    if request.method == "PATCH":
        validar_rol(request.user, MANAGEMENT_ROLES)
        with transaction.atomic():
            sdi = SDI.objects.select_for_update().get(pk=sdi_id)
            if sdi.asignada or sdi.estado != SDI.Estado.PENDIENTE:
                raise ValidationError("Los datos de recepción se corrigen antes de asignar.")
            serializer = SDISerializer(sdi, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            changes = changes_comment(sdi, serializer.validated_data)
            serializer.save()
            record_event(sdi, request.user, "Datos de SDI revisados", changes)
    return Response(detail_data(sdi))


@protected(["POST"])
def intake(request):
    validar_rol(request.user, MANAGEMENT_ROLES)
    upload = request.FILES.get("archivo")
    if not upload:
        raise ValidationError("Adjunta el PDF de la SDI.")
    if upload.size > 20 * 1024 * 1024:
        raise ValidationError("El PDF debe tener hasta 20 MB.")
    sdi, created = receive_pdf(upload.read(), upload.name, request.data.get("correo_origen", ""), request.data.get("asunto_correo", ""), request.user)
    return Response(detail_data(sdi), status=201 if created else 200)


@protected(["POST"])
def assign(request, sdi_id):
    validar_rol(request.user, MANAGEMENT_ROLES)
    from rest_framework import serializers
    value = serializers.IntegerField(min_value=1).run_validation(request.data.get("inspector"))
    inspector = get_object_or_404(get_user_model(), pk=value)
    instructions = serializers.CharField(allow_blank=True).run_validation(request.data.get("instrucciones", ""))
    sdi = assign_sdi(sdi_id, request.user, inspector, instructions)
    return Response(detail_data(sdi))


@protected(["POST"])
def review(request, sdi_id):
    from rest_framework import serializers
    comment = serializers.CharField(allow_blank=True).run_validation(request.data.get("comentario", ""))
    return Response(detail_data(review_results(sdi_id, request.user, comment)))


@protected(["POST"])
def annul(request, sdi_id):
    from rest_framework import serializers
    get_object_or_404(visible_sdis(request.user), pk=sdi_id)
    reason = serializers.CharField(max_length=1000).run_validation(request.data.get("motivo", ""))
    return Response(detail_data(annul_sdi(sdi_id, request.user, reason)))


@protected(["POST"])
def archive(request, sdi_id):
    from rest_framework import serializers
    get_object_or_404(visible_sdis(request.user), pk=sdi_id)
    archived = serializers.BooleanField().run_validation(request.data.get("archivar", True))
    return Response(detail_data(archive_sdi(sdi_id, request.user, archived)))


@protected(["GET", "POST"])
def products(request, sdi_id):
    sdi = get_object_or_404(visible_sdis(request.user), pk=sdi_id)
    if request.method == "GET":
        return Response(ItemSDISerializer(sdi.items.order_by("orden"), many=True).data)
    validar_rol(request.user, MANAGEMENT_ROLES)
    with transaction.atomic():
        sdi = SDI.objects.select_for_update().get(pk=sdi_id)
        if sdi.asignada or sdi.estado != SDI.Estado.PENDIENTE:
            raise ValidationError("Agrega productos antes de asignar la SDI.")
        serializer = ItemSDISerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fields = serializer.validated_data
        quantity = fields["cantidad_a_inspeccionar"]
        if fields.get("cantidad_indicada") is not None and quantity > fields["cantidad_indicada"]:
            raise ValidationError("La cantidad a inspeccionar supera la cantidad indicada.")
        order = (sdi.items.aggregate(max=Max("orden"))["max"] or 0) + 1
        item = serializer.save(sdi=sdi, orden=order)
        item.full_clean()
        record_event(sdi, request.user, "Producto agregado", f"{item.articulo}; indicada: {item.cantidad_indicada}; a inspeccionar: {quantity}", item=item)
    return Response(ItemSDISerializer(item).data, status=201)


@protected(["GET", "PATCH", "DELETE"])
def product_detail(request, item_id):
    item = get_object_or_404(ItemSDI, pk=item_id, sdi__in=visible_sdis(request.user))
    if request.method == "GET":
        return Response(ItemSDISerializer(item).data)
    validar_rol(request.user, MANAGEMENT_ROLES)
    with transaction.atomic():
        sdi = SDI.objects.select_for_update().get(pk=item.sdi_id)
        if sdi.asignada or sdi.estado != SDI.Estado.PENDIENTE:
            raise ValidationError("Los productos solo se corrigen antes de asignar.")
        if request.method == "DELETE":
            if item.inspecciones.exists() or item.resultado_actual != ItemSDI.Resultado.PENDIENTE:
                raise ValidationError("Solo se retiran productos pendientes y sin inspecciones registradas.")
            record_event(sdi, request.user, "Producto retirado de revisión", f"Producto {item.pk}; orden {item.orden}; {item.articulo}; indicada: {item.cantidad_indicada}; a inspeccionar: {item.cantidad_a_inspeccionar}. {item.descripcion}. {item.observaciones}")
            item.delete()
            return Response(status=204)
        serializer = ItemSDISerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        fields = serializer.validated_data
        indicated = fields.get("cantidad_indicada", item.cantidad_indicada)
        quantity = fields.get("cantidad_a_inspeccionar", item.cantidad_a_inspeccionar)
        if indicated is not None and quantity > indicated:
            raise ValidationError("La cantidad a inspeccionar supera la cantidad indicada.")
        changes = changes_comment(item, fields)
        serializer.save(orden=item.orden)
        item.full_clean()
        record_event(sdi, request.user, "Producto corregido", changes, item=item)
    return Response(ItemSDISerializer(item).data)


@protected(["GET"])
def document_file(request, document_id):
    doc = get_object_or_404(DocumentoSDI, pk=document_id, sdi__in=visible_sdis(request.user))
    response = FileResponse(doc.archivo.open("rb"), content_type="application/pdf", as_attachment=True, filename=doc.nombre)
    response["X-Content-Type-Options"] = "nosniff"
    return response


@protected(["POST"])
def upload_evidence(request, inspection_id):
    inspection = inspection_for(request.user, inspection_id)
    if inspection.resultado != InspeccionSDI.Resultado.EN_PROCESO or inspection.item.sdi.estado == SDI.Estado.CERRADA:
        raise ValidationError("Adjunta evidencias antes de finalizar la inspección.")
    file = request.FILES.get("archivo")
    if not file or file.size > 20 * 1024 * 1024:
        raise ValidationError("Adjunta una evidencia de hasta 20 MB.")
    kind = request.data.get("tipo", "documento")
    if kind not in EvidenciaSDI.Tipo.values:
        raise ValidationError("Tipo de evidencia inválido.")
    evidence = EvidenciaSDI.objects.create(inspeccion=inspection, archivo=file, tipo=kind, descripcion=request.data.get("descripcion", ""), subido_por=request.user)
    record_event(inspection.item.sdi, request.user, "Evidencia agregada", f"{file.name} ({kind}). {evidence.descripcion}", item=inspection.item, inspection=inspection)
    return Response(evidence_data(evidence), status=201)


@protected(["GET"])
def evidence_file(request, evidence_id):
    evidence = get_object_or_404(EvidenciaSDI, pk=evidence_id, inspeccion__item__sdi__in=visible_sdis(request.user))
    return FileResponse(evidence.archivo.open("rb"), as_attachment=True)


@protected(["GET"])
def dashboard(request):
    records = visible_sdis(request.user).filter(archivada__isnull=True).exclude(estado=SDI.Estado.ANULADA)
    return Response({
        "en_proceso": {
            "SDI": records.filter(estado="en_proceso").count(),
            "Producto": ItemSDI.objects.filter(sdi__in=records, resultado_actual="en_proceso").count(),
            "Inspección": InspeccionSDI.objects.filter(item__sdi__in=records, resultado="en_proceso").count(),
        },
        "pendientes": records.filter(estado="pendiente").count(),
        "cerradas": records.filter(estado="cerrada").count(),
        "por_revisar": records.filter(asignada__isnull=False, revisada__isnull=True)
            .exclude(estado="cerrada").exclude(items__inspecciones__resultado="en_proceso").count(),
    })
