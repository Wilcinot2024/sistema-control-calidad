from io import BytesIO  # Permite procesar imágenes en memoria.
from PIL import Image, ImageOps  # Permite optimizar y orientar fotografías.
from django.core.files.base import ContentFile  # Prepara el archivo optimizado para Django.
from django.shortcuts import render
from django.contrib.auth import get_user_model
from .serializers import (
    SDISerializer,
    InspectorSerializer,
    CrearInspectorSerializer,
    CambiarEstadoInspectorSerializer,
    ItemSDISerializer,
    InspeccionSDISerializer,
    InspeccionVisualSerializer,
    EvidenciaSDISerializer,  # ETAPA 22 - Serializer de evidencias.
    AprobarInspeccionSerializer,
    RechazarInspeccionSerializer,
    CrearReinspeccionSerializer,
    ConcesionSDISerializer,
SolicitarConcesionSerializer,
ResolverConcesionSerializer,
CerrarSDISerializer,
HistorialSDISerializer,
)
# Modelos utilizados por las APIs de Control de Calidad.
from .models import (
    SDI,
    PerfilUsuario,
    Area,
    ItemSDI,
    InspeccionSDI,
    InspeccionVisual,  # Modelo de inspecciones visuales.
    EvidenciaSDI,
    ConcesionSDI,
    HistorialSDI,
)
from .services import (
    crear_sdi,
    editar_sdi,
    iniciar_sdi,
    terminar_inspeccion_sdi,  # Servicio que finaliza la inspección de una SDI.
    crear_inspector,
    obtener_inspectores,
    cambiar_estado_inspector,
    crear_item_sdi,
    crear_inspeccion,
    registrar_inspeccion_visual,
    aprobar_inspeccion,
    rechazar_inspeccion,
    crear_reinspeccion,
    solicitar_concesion,
    resolver_concesion,
     cerrar_sdi,
    
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
User = get_user_model()

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
# INICIO FORMAL DE UNA SDI
# =========================================================
@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def iniciar_sdi_api(request, sdi_id):
    # Ejecutar el inicio mediante el servicio y sus validaciones.
    try:
        sdi = iniciar_sdi(
            usuario_actual=request.user,
            sdi_id=sdi_id
        )
    except DjangoValidationError as error:
        # Convertir errores del servicio en respuestas HTTP 400.
        raise DRFValidationError(error.messages)

    # Devolver la SDI con su estado actualizado.
    return Response(
        SDISerializer(sdi).data,
        status=200
    )
# =========================================================
# TÉRMINO FORMAL DE LA INSPECCIÓN SDI
# =========================================================
@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def terminar_sdi_api(request, sdi_id):
    # Ejecutar el término y validar el inspector, los productos y el estado.
    try:
        sdi = terminar_inspeccion_sdi(
            usuario_actual=request.user,
            sdi_id=sdi_id
        )
    except DjangoValidationError as error:
        # Convertir errores de validación del servicio en respuestas HTTP 400.
        raise DRFValidationError(error.messages)

    # Devolver la SDI actualizada, pendiente de revisión administrativa.
    return Response(
        SDISerializer(sdi).data,
        status=200
    )
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
        ).exclude(estado=SDI.Estado.PENDIENTE)

    serializer = SDISerializer(
        queryset,
        many=True,
    )

    return Response(serializer.data)



# =========================================================
# ÍTEM 15.2 - CONSULTAR Y EDITAR UNA SDI
# =========================================================

@api_view(["GET", "PATCH"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def detalle_sdi(request, sdi_id):
    # 15.2.1 - Verificar que el usuario tenga un perfil activo.
    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    # 15.2.2 - Preparar la consulta de solicitudes.
    queryset = SDI.objects.select_related(
        "inspector",
        "creado_por",
    )

    # 15.2.3 - El inspector solo puede consultar sus SDI.
    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset = queryset.filter(inspector=request.user).exclude(estado=SDI.Estado.PENDIENTE)

    # 15.2.4 - Obtener la SDI o devolver error 404.
    sdi = get_object_or_404(queryset, pk=sdi_id)

    # 15.2.5 - Consultar los datos de una SDI.
    if request.method == "GET":
        return Response(SDISerializer(sdi).data)

    # 15.2.6 - Solo los roles autorizados pueden editar.
    roles_edicion = [
        PerfilUsuario.Rol.ADMINISTRADOR,
        PerfilUsuario.Rol.JEFE_CALIDAD,
        PerfilUsuario.Rol.SUPERVISOR,
    ]

    if rol not in roles_edicion:
        raise PermissionDenied(
            "No tienes permisos para editar solicitudes SDI."
        )

    # 15.2.7 - Permitir únicamente campos editables.
    campos_permitidos = {
        "fecha_emision",
        "proyecto",
        "departamento_solicitante",
        "solicitante",
        "inspector",
        "prioridad",
        "observaciones",
    }

    # Rechazar cambios al código, estado u otros campos protegidos.
    campos_prohibidos = set(request.data.keys()) - campos_permitidos

    if campos_prohibidos:
        raise DRFValidationError({
            "campos": (
                "No se permite modificar: "
                + ", ".join(sorted(campos_prohibidos))
            )
        })

    # 15.2.8 - Validar los datos recibidos con el serializer.
    serializer = SDISerializer(
        sdi,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)

    # 15.2.9 - Actualizar mediante el servicio de negocio.
    try:
        sdi_actualizada = editar_sdi(
            usuario_actual=request.user,
            sdi_id=sdi.id,
            datos=serializer.validated_data,
        )
    except DjangoValidationError as error:
        if hasattr(error, "message_dict"):
            raise DRFValidationError(error.message_dict)
        raise DRFValidationError(error.messages)

    # 15.2.10 - Devolver los datos actualizados.
    return Response(
        SDISerializer(sdi_actualizada).data,
        status=200,
    )

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
        ).exclude(estado=SDI.Estado.PENDIENTE)

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
            orden=None,  # El servicio genera el número automáticamente.
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
        ).exclude(sdi__estado=SDI.Estado.PENDIENTE)

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

      # El inspector solo puede consultar productos de sus SDI asignadas.
      # Se incluyen las SDI pendientes para permitir iniciar la inspección.
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
    # Utilizar el inspector autenticado o el seleccionado por el supervisor.
    # El inspector utiliza su propia sesión; los supervisores deben indicar un inspector.
    if rol == PerfilUsuario.Rol.INSPECTOR:
        inspector_asignado = request.user
    else:
        inspector_asignado = datos.get("inspector")
        if inspector_asignado is None:
            raise DRFValidationError({
                "inspector": "Debes seleccionar un inspector."
            })

    try:
        inspeccion = crear_inspeccion(
            usuario_actual=request.user,
            item_id=item.id,
            inspector=inspector_asignado,
            cantidad_inspeccionada=datos["cantidad_inspeccionada"],
            observaciones=datos.get("observaciones", ""),
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
        ).filter(item__sdi__inspector=request.user).exclude(item__sdi__estado=SDI.Estado.PENDIENTE)

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
# ÍTEM 10.8 - API INSPECCIÓN VISUAL
# =========================================================

@api_view(["GET", "POST", "PATCH"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def inspeccion_visual_api(request, inspeccion_id):

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
        ).filter(item__sdi__inspector=request.user).exclude(item__sdi__estado=SDI.Estado.PENDIENTE)

    inspeccion = get_object_or_404(
        queryset,
        pk=inspeccion_id,
    )

    # 10.8.7 - Consultar visual
    if request.method == "GET":

        visual = get_object_or_404(
            InspeccionVisual,
            inspeccion=inspeccion,
        )

        return Response(
            InspeccionVisualSerializer(
                visual
            ).data
        )

    # 10.8.8 - Registrar / actualizar visual
    serializer = InspeccionVisualSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    try:
        visual = registrar_inspeccion_visual(
            usuario=request.user,
            inspeccion_id=inspeccion.id,
            rebarbas=datos["rebarbas"],
            rayaduras=datos["rayaduras"],
            golpes=datos["golpes"],
            deformidad=datos["deformidad"],
            pintura=datos["pintura"],
            burbujas=datos["burbujas"],
            planitud=datos["planitud"],
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
        InspeccionVisualSerializer(
            visual
        ).data,
        status=201 if request.method == "POST" else 200,
    )

# =========================================================
# ETAPA 22 - API DE EVIDENCIAS DE INSPECCIÓN
# =========================================================
@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def evidencias_inspeccion_api(request, inspeccion_id):
    # Verifica que el usuario tenga un perfil activo.
    rol = obtener_rol(request.user)
        # ETAPA 24.7 - Permitir consultar evidencias según el rol.
    roles_consulta = [
        PerfilUsuario.Rol.ADMINISTRADOR,
        PerfilUsuario.Rol.INSPECTOR,
        PerfilUsuario.Rol.SUPERVISOR,
        PerfilUsuario.Rol.JEFE_CALIDAD,
    ]

    # GET: los roles autorizados pueden consultar fotografías.
    if request.method == "GET":
        if rol not in roles_consulta:
            raise PermissionDenied("No tienes permisos para consultar evidencias.")

    # POST: únicamente el inspector puede registrar fotografías.
    else:
        if rol != PerfilUsuario.Rol.INSPECTOR:
            raise PermissionDenied("Solo el inspector puede registrar evidencias.")

    # El inspector solamente puede acceder a sus inspecciones asignadas.
    queryset = InspeccionSDI.objects.select_related("item__sdi", "inspector")
    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset = queryset.filter(
            inspector=request.user,
            item__sdi__inspector=request.user
        ).exclude(item__sdi__estado=SDI.Estado.PENDIENTE)

    inspeccion = get_object_or_404(queryset, pk=inspeccion_id)

    # Consulta las fotografías y documentos registrados.
    if request.method == "GET":
        evidencias = EvidenciaSDI.objects.filter(
            inspeccion=inspeccion
        ).select_related("subido_por").order_by("-fecha")
        return Response(EvidenciaSDISerializer(evidencias, many=True).data)

    # Impide agregar evidencias a inspecciones finalizadas.
    if inspeccion.fecha_fin is not None:
        raise DRFValidationError("No se pueden agregar evidencias a una inspección finalizada.")

    # Valida el archivo y la descripción recibidos.
    serializer = EvidenciaSDISerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    datos = serializer.validated_data

    archivo = datos["archivo"]
        # ETAPA 22 - Validar extensiones y tipos MIME de fotografías.
    import os

    tipos_permitidos = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }

    extension = os.path.splitext(archivo.name)[1].lower()

    if tipos_permitidos.get(extension) != archivo.content_type:
        raise DRFValidationError({
            "archivo": "Solo se permiten fotografías JPG, JPEG, PNG o WEBP."
        })
    if archivo.size > 10 * 1024 * 1024:
        raise DRFValidationError({"archivo": "La fotografía no puede superar los 10 MB."})
    if datos["tipo"] != EvidenciaSDI.Tipo.FOTO:
        raise DRFValidationError({"tipo": "Esta API admite fotografías de inspección."})
        # ETAPA 22 - Optimizar la fotografía antes de almacenarla.
    try:
        with Image.open(archivo) as imagen:
            imagen.verify()  # Comprueba que el archivo sea una imagen válida.

        archivo.seek(0)
        with Image.open(archivo) as imagen:
            imagen = ImageOps.exif_transpose(imagen)  # Corrige la orientación.
            imagen.thumbnail((1920, 1920))  # Reduce dimensiones sin deformar.

            if imagen.mode != "RGB":
                imagen = imagen.convert("RGB")

            buffer = BytesIO()
            imagen.save(buffer, format="JPEG", quality=85, optimize=True)

        nombre_original = os.path.splitext(os.path.basename(archivo.name))[0]
        archivo = ContentFile(
            buffer.getvalue(),
            name=f"{nombre_original}.jpg"
        )
    except (OSError, ValueError, SyntaxError):
        raise DRFValidationError({
            "archivo": "La fotografía está dañada o no se puede procesar."
        })

    # Registra la fotografía y el usuario responsable.
    evidencia = EvidenciaSDI.objects.create(
        inspeccion=inspeccion,
        tipo=datos["tipo"],
        archivo=archivo,
        descripcion=datos.get("descripcion", ""),
        subido_por=request.user,
    )
        # ETAPA 22 - Registrar la evidencia en la trazabilidad de la SDI.
    HistorialSDI.objects.create(
        sdi=inspeccion.item.sdi,
        item=inspeccion.item,
        inspeccion=inspeccion,
        usuario=request.user,
        accion="evidencia_agregada",
        comentario=f"Fotografía registrada: {evidencia.archivo.name}",
    )
    return Response(EvidenciaSDISerializer(evidencia).data, status=201)

# =========================================================
# 10.8 - APROBAR INSPECCIÓN
# =========================================================

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def aprobar_inspeccion_api(request, inspeccion_id):

    serializer = AprobarInspeccionSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    cantidad_aprobada = serializer.validated_data.get(
        "cantidad_aprobada"
    )

    try:
        inspeccion = aprobar_inspeccion(
            inspeccion_id=inspeccion_id,
            usuario=request.user,
            cantidad_aprobada=cantidad_aprobada,
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        InspeccionSDISerializer(
            inspeccion
        ).data
    )
# =========================================================
# 10.8 - RECHAZAR INSPECCIÓN
# =========================================================

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def rechazar_inspeccion_api(request, inspeccion_id):

    serializer = RechazarInspeccionSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    try:
        rechazo = rechazar_inspeccion(
            inspeccion_id=inspeccion_id,
            usuario=request.user,
            motivo=datos["motivo"],
            descripcion=datos["descripcion"],
            cantidad_afectada=datos["cantidad_afectada"],
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    inspeccion = rechazo.inspeccion

    return Response(
        InspeccionSDISerializer(
            inspeccion
        ).data
    )

# =========================================================
# ÍTEM 10.9 - API DE REINSPECCIÓN
# =========================================================

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def crear_reinspeccion_api(request, item_id):

    serializer = CrearReinspeccionSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    inspector = get_object_or_404(
        User,
        pk=datos["inspector"],
    )

    try:
        reinspeccion = crear_reinspeccion(
            item_id=item_id,
            inspector=inspector,
            usuario=request.user,
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
            reinspeccion
        ).data,
        status=201,
    )

# =========================================================
# ÍTEM 10.10 - API DE CONCESIONES
# =========================================================

@api_view(["GET", "POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def concesiones_inspeccion_api(request, inspeccion_id):

    rol = obtener_rol(request.user)

    roles_permitidos = [
        PerfilUsuario.Rol.ADMINISTRADOR,
        PerfilUsuario.Rol.JEFE_CALIDAD,
        PerfilUsuario.Rol.SUPERVISOR,
    ]

    if rol not in roles_permitidos:
        raise PermissionDenied(
            "No tienes permisos para gestionar concesiones."
        )

    inspeccion = get_object_or_404(
        InspeccionSDI,
        pk=inspeccion_id,
    )

    # 10.10.1 - Listar concesiones
    if request.method == "GET":

        concesiones = (
            ConcesionSDI.objects
            .filter(inspeccion=inspeccion)
            .select_related(
                "inspeccion",
                "inspeccion__item",
                "inspeccion__item__sdi",
                "registrado_por",
            )
            .order_by("-id")
        )

        return Response(
            ConcesionSDISerializer(
                concesiones,
                many=True,
            ).data
        )

    # 10.10.2 - Solicitar concesión
    serializer = SolicitarConcesionSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    try:
        concesion = solicitar_concesion(
            inspeccion_id=inspeccion.id,
            usuario=request.user,
            responsable_ingenieria=datos[
                "responsable_ingenieria"
            ],
            justificacion=datos[
                "justificacion"
            ],
            observaciones=datos.get(
                "observaciones",
                "",
            ),
            documento=datos.get(
                "documento"
            ),
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        ConcesionSDISerializer(
            concesion
        ).data,
        status=201,
    )


@api_view(["PATCH"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def resolver_concesion_api(request, concesion_id):

    serializer = ResolverConcesionSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    datos = serializer.validated_data

    try:
        concesion = resolver_concesion(
            concesion_id=concesion_id,
            usuario=request.user,
            decision=datos["decision"],
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
        ConcesionSDISerializer(
            concesion
        ).data
    )
# =========================================================
# ÍTEM 10.11 - API DE CIERRE DE SDI
# =========================================================

@api_view(["POST"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def cerrar_sdi_api(request, sdi_id):

    serializer = CerrarSDISerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    comentario = serializer.validated_data.get(
        "comentario",
        "",
    )

    try:
        sdi = cerrar_sdi(
            sdi_id=sdi_id,
            usuario=request.user,
            comentario=comentario,
        )

    except DjangoValidationError as e:
        raise DRFValidationError(
            e.messages
        )

    return Response(
        SDISerializer(sdi).data
    )
# =========================================================
# ÍTEM 10.12 - API DE HISTORIAL
# =========================================================

@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def historial_sdi_api(request, sdi_id):

    rol = obtener_rol(request.user)

    if not rol:
        raise PermissionDenied(
            "Tu usuario no tiene un perfil activo."
        )

    queryset_sdi = SDI.objects.all()

    # 10.12.1 - Inspector solo puede ver SDI asignadas
    if rol == PerfilUsuario.Rol.INSPECTOR:
        queryset_sdi = queryset_sdi.filter(
            inspector=request.user
        ).exclude(estado=SDI.Estado.PENDIENTE)

    sdi = get_object_or_404(
        queryset_sdi,
        pk=sdi_id,
    )

    # 10.12.2 - Obtener historial
    historial = (
        HistorialSDI.objects
        .filter(sdi=sdi)
        .select_related(
            "usuario",
            "item",
            "inspeccion",
        )
        .order_by("fecha")
    )

    return Response(
        HistorialSDISerializer(
            historial,
            many=True,
        ).data
    )