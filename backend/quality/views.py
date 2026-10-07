from django.shortcuts import render
from .serializers import (
    SDISerializer,
    InspectorSerializer,
    CrearInspectorSerializer,
    CambiarEstadoInspectorSerializer,
    ItemSDISerializer,
    InspeccionSDISerializer,
)
from .models import (
    SDI,
    PerfilUsuario,
    Area,
    ItemSDI,
    InspeccionSDI,
    PerfilUsuario,
    Area,
)
from .services import (
    crear_sdi,
    crear_inspector,
    obtener_inspectores,
    cambiar_estado_inspector,
    crear_item_sdi,
    crear_inspeccion,
)
# Create your views here.
# =========================================================
# ÍTEM 10.2 - USUARIO AUTENTICADO
# =========================================================

from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404

from rest_framework.exceptions import PermissionDenied

from .models import SDI, PerfilUsuario
from .serializers import SDISerializer
from .permissions import obtener_rol
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework.exceptions import ValidationError as DRFValidationError

from .services import crear_sdi


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def usuario_actual(request):

    usuario = request.user
    perfil = getattr(usuario, "perfil", None)

    return Response({
        "id": usuario.id,
        "username": usuario.username,
        "first_name": usuario.first_name,
        "last_name": usuario.last_name,
        "email": usuario.email,
        "rol": perfil.rol if perfil else None,
        "rol_nombre": perfil.get_rol_display() if perfil else None,
        "activo": perfil.activo if perfil else False,
    })

# =========================================================
# ÍTEM 10.4 - API SDI
# =========================================================


# 10.4.1 - Listar SDI
@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def listar_sdi(request):
        # =====================================================
    # 10.5 - CREAR SDI
    # =====================================================

    if request.method == "POST":

        serializer = SDISerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        datos = serializer.validated_data

        try:
            nueva_sdi = crear_sdi(
                usuario_actual=request.user,
                inspector=datos["inspector"],
                activacion_proyecto=datos["activacion_proyecto"],
                numero_sdi=datos["numero_sdi"],
                fecha_emision=datos["fecha_emision"],
                proyecto=datos["proyecto"],
                departamento_solicitante=datos[
                    "departamento_solicitante"
                ],
                solicitante=datos["solicitante"],
                prioridad=datos.get(
                    "prioridad",
                    SDI.Prioridad.MEDIA,
                ),
                observaciones=datos.get(
                    "observaciones",
                    "",
                ),
                prefijo_bod=datos.get(
                    "prefijo_bod",
                    False,
                ),
            )

        except DjangoValidationError as e:
            raise DRFValidationError(
                e.messages
            )

        return Response(
            SDISerializer(nueva_sdi).data,
            status=201,
        )

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset = (
        SDI.objects
        .select_related(
            "inspector",
            "creado_por",
        )
        .order_by("-creada")
    )

    # Inspector solo ve sus SDI
    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset = queryset.filter(
            inspector=request.user
        )

    serializer = SDISerializer(
        queryset,
        many=True,
    )

    return Response(serializer.data)


# 10.4.2 - Detalle de una SDI
@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def detalle_sdi(request, sdi_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset = SDI.objects.select_related(
        "inspector",
        "creado_por",
    )

    # Inspector solo puede consultar sus SDI
    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset = queryset.filter(
            inspector=request.user
        )

    sdi = get_object_or_404(
        queryset,
        pk=sdi_id,
    )

    serializer = SDISerializer(sdi)

    return Response(serializer.data)

# =========================================================
# ÍTEM 10.6 - API DE INSPECTORES
# =========================================================

@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inspectores_api(request):

    # 10.6.2 - Listar Inspectores
    if request.method == "GET":

        inspectores = obtener_inspectores(
            request.user
        )

        serializer = InspectorSerializer(
            inspectores,
            many=True,
        )

        return Response(serializer.data)

    # 10.6.3 - Crear Inspector
    serializer = CrearInspectorSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    area = None

    if datos.get("area_id"):
        area = get_object_or_404(
            Area,
            pk=datos["area_id"],
        )

    try:
        nuevo_inspector = crear_inspector(
            usuario_actual=request.user,
            username=datos["username"],
            password=datos["password"],
            first_name=datos.get(
                "first_name",
                "",
            ),
            last_name=datos.get(
                "last_name",
                "",
            ),
            email=datos.get(
                "email",
                "",
            ),
            area=area,
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        InspectorSerializer(
            nuevo_inspector
        ).data,
        status=201,
    )
# =========================================================
# 10.6.4 - ACTIVAR / DESACTIVAR INSPECTOR
# =========================================================

@api_view(["PATCH"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def estado_inspector_api(request, inspector_id):

    serializer = CambiarEstadoInspectorSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    try:
        inspector = cambiar_estado_inspector(
            usuario_actual=request.user,
            inspector_id=inspector_id,
            activo=serializer.validated_data["activo"],
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        InspectorSerializer(inspector).data
    )
# =========================================================
# ÍTEM 10.7 - API DE ÍTEMS / PRODUCTOS
# =========================================================

@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def items_sdi_api(request, sdi_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    # Inspector solo puede acceder a sus SDI
    queryset_sdi = SDI.objects.all()

    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset_sdi = queryset_sdi.filter(
            inspector=request.user
        )

    sdi = get_object_or_404(
        queryset_sdi,
        pk=sdi_id,
    )

    # 10.7.8 - Listar productos
    if request.method == "GET":

        items = (
            ItemSDI.objects
            .filter(sdi=sdi)
            .order_by("orden")
        )

        return Response(
            ItemSDISerializer(
                items,
                many=True
            ).data
        )

    # 10.7.9 - Crear producto
    serializer = ItemSDISerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    try:
        item = crear_item_sdi(
            usuario_actual=request.user,
            sdi_id=sdi.id,
            orden=datos["orden"],
            articulo=datos["articulo"],
            cantidad_a_inspeccionar=datos[
                "cantidad_a_inspeccionar"
            ],
            codigo_plano=datos.get(
                "codigo_plano",
                "",
            ),
            observaciones=datos.get(
                "observaciones",
                "",
            ),
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        ItemSDISerializer(item).data,
        status=201,
    )


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def detalle_item_api(request, item_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset = ItemSDI.objects.select_related(
        "sdi",
        "sdi__inspector",
    )

    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset = queryset.filter(
            sdi__inspector=request.user
        )

    item = get_object_or_404(
        queryset,
        pk=item_id,
    )

    return Response(
        ItemSDISerializer(item).data
    )

    # =========================================================
# ÍTEM 10.8 - API DE INSPECCIONES
# =========================================================

@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inspecciones_item_api(request, item_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset_item = ItemSDI.objects.select_related(
        "sdi",
        "sdi__inspector",
    )

    # Inspector solo accede a sus SDI
    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset_item = queryset_item.filter(
            sdi__inspector=request.user
        )

    item = get_object_or_404(
        queryset_item,
        pk=item_id,
    )

    # 10.8.1 - Listar inspecciones
    if request.method == "GET":

        inspecciones = (
            InspeccionSDI.objects
            .filter(item=item)
            .select_related("inspector")
            .order_by("numero_inspeccion")
        )

        if rol == PerfilUsuario.Rol.INSPECTOR:
            inspecciones = inspecciones.filter(
                inspector=request.user
            )

        return Response(
            InspeccionSDISerializer(
                inspecciones,
                many=True,
            ).data
        )

    # 10.8.2 - Crear inspección
    serializer = InspeccionSDISerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    try:
        inspeccion = crear_inspeccion(
            usuario_actual=request.user,
            item_id=item.id,
            inspector=datos["inspector"],
            cantidad_inspeccionada=datos[
                "cantidad_inspeccionada"
            ],
            observaciones=datos.get(
                "observaciones",
                "",
            ),
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        InspeccionSDISerializer(
            inspeccion
        ).data,
        status=201,
    )


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def detalle_inspeccion_api(request, inspeccion_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset = (
        InspeccionSDI.objects
        .select_related(
            "item",
            "item__sdi",
            "inspector",
        )
    )

    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset = queryset.filter(
            inspector=request.user
        )

    inspeccion = get_object_or_404(
        queryset,
        pk=inspeccion_id,
    )

    return Response(
        InspeccionSDISerializer(
            inspeccion
        ).data
    )

    # =========================================================
# ÍTEM 10.8 - API DE INSPECCIONES
# =========================================================

@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inspecciones_item_api(request, item_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset_item = ItemSDI.objects.select_related(
        "sdi",
        "sdi__inspector",
    )

    # Inspector solo accede a sus SDI
    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset_item = queryset_item.filter(
            sdi__inspector=request.user
        )

    item = get_object_or_404(
        queryset_item,
        pk=item_id,
    )

    # 10.8.1 - Listar inspecciones
    if request.method == "GET":

        inspecciones = (
            InspeccionSDI.objects
            .filter(item=item)
            .select_related("inspector")
            .order_by("numero_inspeccion")
        )

        if rol == PerfilUsuario.Rol.INSPECTOR:
            inspecciones = inspecciones.filter(
                inspector=request.user
            )

        return Response(
            InspeccionSDISerializer(
                inspecciones,
                many=True,
            ).data
        )

    # 10.8.2 - Crear inspección
    serializer = InspeccionSDISerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    try:
        inspeccion = crear_inspeccion(
            usuario_actual=request.user,
            item_id=item.id,
            inspector=datos["inspector"],
            cantidad_inspeccionada=datos[
                "cantidad_inspeccionada"
            ],
            observaciones=datos.get(
                "observaciones",
                "",
            ),
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        InspeccionSDISerializer(
            inspeccion
        ).data,
        status=201,
    )


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def detalle_inspeccion_api(request, inspeccion_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset = (
        InspeccionSDI.objects
        .select_related(
            "item",
            "item__sdi",
            "inspector",
        )
    )

    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset = queryset.filter(
            inspector=request.user
        )

    inspeccion = get_object_or_404(
        queryset,
        pk=inspeccion_id,
    )

    return Response(
        InspeccionSDISerializer(
            inspeccion
        ).data
    )