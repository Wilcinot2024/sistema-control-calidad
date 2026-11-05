from datetime import date  # Fecha de emisión de la SDI.
from django.contrib.auth import get_user_model  # Modelo de usuario.
from django.core.exceptions import PermissionDenied, ValidationError  # Excepciones de permisos y validación.
from django.test import TestCase  # Pruebas automatizadas.
from django.urls import reverse  # Obtiene la ruta registrada del endpoint.
from rest_framework.test import APIClient  # Simula solicitudes HTTP a la API.
from .models import HistorialSDI, PerfilUsuario, SDI, ItemSDI, InspeccionSDI, ConcesionSDI,RevisionSDI  # Modelos para las pruebas.
from .services import cerrar_sdi, crear_sdi, iniciar_sdi, crear_inspeccion, terminar_inspeccion_sdi, aceptar_revision_sdi, no_aceptar_revision_sdi,solicitar_reinspeccion_revision_sdi # Registra solicitudes de reinspección.


# =========================================================
# PRUEBA 1 - CREACIÓN DE UNA SDI
# =========================================================

class CrearSDITests(TestCase):

    # Preparar un supervisor activo para crear la SDI.
    def setUp(self):
        User = get_user_model()

        self.supervisor = User.objects.create_user(
            username="supervisor_creacion",
            password="ClaveTemporalPrueba123"
        )

        PerfilUsuario.objects.create(
            usuario=self.supervisor,
            rol=PerfilUsuario.Rol.SUPERVISOR,
            activo=True
        )

    # Verificar que una SDI nueva se cree PENDIENTE y sin inspector.
    def test_crear_sdi_pendiente_sin_inspector(self):
        sdi = crear_sdi(
            usuario_actual=self.supervisor,
            activacion_proyecto="123456",
            numero_sdi="999002",
            fecha_emision=date.today(),
            proyecto="Proyecto de prueba",
            departamento_solicitante="Calidad",
            solicitante="Usuario de prueba"
        )

        # Confirmar el estado inicial y la ausencia de inspector.
        sdi.refresh_from_db()
        self.assertEqual(sdi.estado, SDI.Estado.PENDIENTE)
        self.assertIsNone(sdi.inspector)

        # Verificar que la creación quede registrada en el historial.
        historial = HistorialSDI.objects.get(
            sdi=sdi,
            accion="SDI creada"
        )
        self.assertEqual(historial.usuario, self.supervisor)
        self.assertEqual(historial.estado_nuevo, SDI.Estado.PENDIENTE)


# =========================================================
# PRUEBA 2 - CIERRE DE UNA SDI
# =========================================================

class CerrarSDITests(TestCase):

    # Preparar los datos necesarios para la prueba.
    def setUp(self):
        User = get_user_model()

        self.usuario = User.objects.create_user(
            username="supervisor_prueba",
            password="ClaveTemporalPrueba123"
        )

        PerfilUsuario.objects.create(
            usuario=self.usuario,
            rol=PerfilUsuario.Rol.SUPERVISOR,
            activo=True
        )

        self.sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="123456",
            numero_sdi="999001",
            fecha_emision=date.today(),
            proyecto="Proyecto de prueba",
            departamento_solicitante="Calidad",
            solicitante="Usuario de prueba",
            inspector=self.usuario,
            creado_por=self.usuario,
            estado=SDI.Estado.CERRADA
        )

    # Verificar que una SDI cerrada no pueda cerrarse nuevamente.
    def test_no_permite_cerrar_sdi_ya_cerrada(self):
        with self.assertRaisesMessage(
            ValidationError,
            "La SDI ya se encuentra cerrada."
        ):
            cerrar_sdi(
                sdi_id=self.sdi.id,
                usuario=self.usuario
            )

        # Confirmar que la SDI permanece cerrada.
        self.sdi.refresh_from_db()
        self.assertEqual(
            self.sdi.estado,
            SDI.Estado.CERRADA
        )
            # Impedir el cierre administrativo de una SDI todavía en inspección.
    def test_rechaza_cierre_si_sdi_en_proceso(self):
        self.sdi.estado = SDI.Estado.EN_PROCESO
        self.sdi.save(update_fields=["estado"])

        with self.assertRaisesMessage(
            ValidationError,
            "La SDI debe estar pendiente de revisión antes de cerrarse."
        ):
            cerrar_sdi(sdi_id=self.sdi.id, usuario=self.usuario)

        # Verificar que el estado no cambió ni se registró un cierre.
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)
        self.assertFalse(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                accion="SDI cerrada"
            ).exists()
        )

    # Permitir el cierre administrativo después de la revisión.
    def test_permite_cerrar_sdi_pendiente_de_revision(self):
        self.sdi.estado = SDI.Estado.PENDIENTE_DE_REVISION
        self.sdi.save(update_fields=["estado"])

        # Registrar un producto aprobado con los campos reales del modelo.
        item = ItemSDI.objects.create(
            sdi=self.sdi,
            orden=1,                                    # Posición del producto en la SDI.
            codigo_plano="PL-001",                     # Código del plano.
            articulo="Producto de prueba",             # Descripción del artículo.
            cantidad_a_inspeccionar=10,                # Unidades solicitadas.
            unidades_liberadas=10,                     # Unidades aprobadas.
            resultado_actual=ItemSDI.Resultado.APROBADA
        )

        # Cerrar la SDI mediante el servicio.
        cerrar_sdi(
            sdi_id=self.sdi.id,
            usuario=self.usuario,
            comentario="Revisión administrativa completada."
        )

        self.sdi.refresh_from_db()
        item.refresh_from_db()

        # Comprobar el cierre, la fecha y la conservación del resultado.
        self.assertEqual(self.sdi.estado, SDI.Estado.CERRADA)
        self.assertIsNotNone(self.sdi.fecha_cierre)
        self.assertEqual(item.resultado_actual, ItemSDI.Resultado.APROBADA)

        # Comprobar que el historial identifica la transición correcta.
        historial = HistorialSDI.objects.get(
            sdi=self.sdi,
            accion="SDI cerrada"
        )
        self.assertEqual(
            historial.estado_anterior,
            SDI.Estado.PENDIENTE_DE_REVISION
        )
        self.assertEqual(historial.estado_nuevo, SDI.Estado.CERRADA)
        self.assertEqual(historial.usuario, self.usuario)
# =========================================================
# PRUEBA 3 - INICIO FORMAL DE UNA SDI
# =========================================================

class IniciarSDITests(TestCase):

    # Preparar inspectores y una SDI pendiente.
    def setUp(self):
        User = get_user_model()

        self.inspector = User.objects.create_user(
            username="inspector_inicio",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.otro_inspector = User.objects.create_user(
            username="inspector_no_asignado",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.otro_inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="123456",
            numero_sdi="999003",
            fecha_emision=date.today(),
            proyecto="Proyecto de prueba",
            departamento_solicitante="Producción",
            solicitante="Usuario de prueba",
            inspector=self.inspector,
            creado_por=self.inspector,
            estado=SDI.Estado.PENDIENTE
        )

    # El inspector asignado puede iniciar la SDI.
    def test_inspector_asignado_puede_iniciar_sdi(self):
        iniciar_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

        # Comprobar el registro de inicio en el historial.
        historial = HistorialSDI.objects.get(
            sdi=self.sdi,
            accion="Inicio formal de SDI"
        )
        self.assertEqual(historial.usuario, self.inspector)
        self.assertEqual(historial.estado_anterior, SDI.Estado.PENDIENTE)
        self.assertEqual(historial.estado_nuevo, SDI.Estado.EN_PROCESO)

    # Impedir que otro inspector inicie una SDI ajena.
    def test_inspector_no_asignado_no_puede_iniciar(self):
        with self.assertRaises(ValidationError):
            iniciar_sdi(self.otro_inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE)

    # Impedir que un inspector inactivo inicie la SDI.
    def test_inspector_inactivo_no_puede_iniciar(self):
        self.inspector.perfil.activo = False
        self.inspector.perfil.save(update_fields=["activo"])

        # El sistema debe rechazar al inspector con perfil inactivo.
        with self.assertRaises(PermissionDenied):
            iniciar_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE)

    # Impedir iniciar nuevamente una SDI en proceso.
    def test_no_permite_iniciar_sdi_dos_veces(self):
        iniciar_sdi(self.inspector, self.sdi.id)

        with self.assertRaises(ValidationError):
            iniciar_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

        # Debe existir un solo registro de inicio.
        self.assertEqual(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                accion="Inicio formal de SDI"
            ).count(),
            1
        )
        # =========================================================
# PRUEBA 4 - API DE INICIO FORMAL DE SDI
# =========================================================
class IniciarSDIAPITests(TestCase):

    # Preparar inspectores, cliente HTTP y SDI pendiente.
    def setUp(self):
        User = get_user_model()

        self.inspector = User.objects.create_user(
            username="inspector_api",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.otro_inspector = User.objects.create_user(
            username="otro_inspector_api",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.otro_inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="123456",
            numero_sdi="999004",
            fecha_emision=date.today(),
            proyecto="Proyecto de prueba API",
            departamento_solicitante="Producción",
            solicitante="Usuario de prueba",
            inspector=self.inspector,
            creado_por=self.inspector,
            estado=SDI.Estado.PENDIENTE
        )

        self.cliente = APIClient()
        self.url = reverse("iniciar_sdi_api", kwargs={"sdi_id": self.sdi.id})

    # Rechazar solicitudes que no tengan autenticación JWT.
    def test_rechaza_usuario_sin_autenticacion(self):
        respuesta = self.cliente.post(self.url, format="json")
        self.assertEqual(respuesta.status_code, 401)

    # Permitir iniciar la SDI al inspector asignado.
    def test_inspector_asignado_inicia_desde_api(self):
        self.cliente.force_authenticate(user=self.inspector)
        respuesta = self.cliente.post(self.url, format="json")

        self.assertEqual(respuesta.status_code, 200)
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

        # Verificar que la API haya generado el historial.
        self.assertTrue(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                usuario=self.inspector,
                accion="Inicio formal de SDI"
            ).exists()
        )

    # Rechazar al inspector que no tiene asignada la SDI.
    def test_rechaza_inspector_no_asignado(self):
        self.cliente.force_authenticate(user=self.otro_inspector)
        respuesta = self.cliente.post(self.url, format="json")

        self.assertEqual(respuesta.status_code, 400)
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE)

    # Rechazar al inspector cuyo perfil está inactivo.
    def test_rechaza_inspector_inactivo(self):
        self.inspector.perfil.activo = False
        self.inspector.perfil.save(update_fields=["activo"])

        self.cliente.force_authenticate(user=self.inspector)
        respuesta = self.cliente.post(self.url, format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE)

    # Impedir que el endpoint inicie dos veces una SDI.
    def test_rechaza_segundo_inicio(self):
        self.cliente.force_authenticate(user=self.inspector)

        primera = self.cliente.post(self.url, format="json")
        segunda = self.cliente.post(self.url, format="json")

        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 400)

        # Debe registrarse un único inicio.
        self.assertEqual(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                accion="Inicio formal de SDI"
            ).count(),
            1
        )

# =========================================================
# PRUEBA 5 - CREACIÓN DE INSPECCIONES
# =========================================================
class CrearInspeccionTests(TestCase):

    # Preparar un inspector activo, una SDI y un producto.
    def setUp(self):
        User = get_user_model()

        self.inspector = User.objects.create_user(
            username="inspector_crear_inspeccion",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="123456",
            numero_sdi="999005",
            fecha_emision=date.today(),
            proyecto="Proyecto de prueba",
            departamento_solicitante="Producción",
            solicitante="Usuario de prueba",
            inspector=self.inspector,
            creado_por=self.inspector,
            estado=SDI.Estado.PENDIENTE
        )

        self.item = ItemSDI.objects.create(
            sdi=self.sdi,
            orden=1,
            codigo_plano="PL-001",
            articulo="Producto de prueba",
            cantidad_a_inspeccionar=10
        )

    # Una SDI pendiente no permite crear inspecciones.
    def test_rechaza_inspeccion_si_sdi_pendiente(self):
        with self.assertRaisesMessage(
            ValidationError,
            "Debes iniciar formalmente la SDI"
        ):
            crear_inspeccion(
                usuario_actual=self.inspector,
                item_id=self.item.id,
                inspector=self.inspector,
                cantidad_inspeccionada=5
            )

        # Confirmar que no se creó ninguna inspección.
        self.assertEqual(
            InspeccionSDI.objects.filter(item=self.item).count(),
            0
        )
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE)

    # Una SDI iniciada permite registrar su primera inspección.
    def test_permite_inspeccion_si_sdi_en_proceso(self):
        iniciar_sdi(self.inspector, self.sdi.id)

        inspeccion = crear_inspeccion(
            usuario_actual=self.inspector,
            item_id=self.item.id,
            inspector=self.inspector,
            cantidad_inspeccionada=5
        )

        # Verificar la inspección y su cantidad registrada.
        self.assertEqual(inspeccion.numero_inspeccion, 1)
        self.assertEqual(inspeccion.cantidad_inspeccionada, 5)
        self.assertEqual(inspeccion.inspector, self.inspector)

        # El producto cambia, pero la SDI permanece EN_PROCESO.
        self.item.refresh_from_db()
        self.sdi.refresh_from_db()
        self.assertEqual(
            self.item.resultado_actual,
            ItemSDI.Resultado.EN_PROCESO
        )
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

        # Confirmar la trazabilidad de la inspección.
        self.assertTrue(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                inspeccion=inspeccion,
                accion="Inspección iniciada"
            ).exists()
        )
# =========================================================
# PRUEBAS API - TÉRMINO FORMAL DE INSPECCIÓN SDI
# =========================================================
class TerminarSDIAPITests(TestCase):

    # Preparar inspectores, SDI en proceso y producto aprobado.
    def setUp(self):
        User = get_user_model()

        self.inspector = User.objects.create_user(
            username="inspector_terminar_api",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.otro_inspector = User.objects.create_user(
            username="otro_inspector_terminar_api",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.otro_inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="123456",
            numero_sdi="999006",
            fecha_emision=date.today(),
            proyecto="Proyecto prueba término API",
            departamento_solicitante="Producción",
            solicitante="Usuario de prueba",
            inspector=self.inspector,
            creado_por=self.inspector,
            estado=SDI.Estado.EN_PROCESO
        )

        self.item = ItemSDI.objects.create(
            sdi=self.sdi,
            orden=1,
            codigo_plano="PL-001",
            articulo="Producto de prueba",
            cantidad_a_inspeccionar=10,
            unidades_liberadas=10,
            resultado_actual=ItemSDI.Resultado.APROBADA
        )

        self.cliente = APIClient()
        self.url = reverse("terminar_sdi_api", kwargs={"sdi_id": self.sdi.id})

    # Rechazar solicitudes sin autenticación.
    def test_rechaza_usuario_sin_autenticacion(self):
        respuesta = self.cliente.post(self.url, format="json")
        self.assertEqual(respuesta.status_code, 401)

    # Permitir al inspector asignado terminar la inspección.
    def test_inspector_asignado_termina_desde_api(self):
        self.cliente.force_authenticate(user=self.inspector)
        respuesta = self.cliente.post(self.url, format="json")

        self.assertEqual(respuesta.status_code, 200)
        self.sdi.refresh_from_db()
        self.assertEqual(
            self.sdi.estado,
            SDI.Estado.PENDIENTE_DE_REVISION
        )

        # Comprobar la transición y su trazabilidad.
        self.assertTrue(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                usuario=self.inspector,
                accion="Inspección SDI terminada",
                estado_anterior=SDI.Estado.EN_PROCESO,
                estado_nuevo=SDI.Estado.PENDIENTE_DE_REVISION
            ).exists()
        )

    # Rechazar al inspector que no tiene asignada la SDI.
    def test_rechaza_inspector_no_asignado(self):
        self.cliente.force_authenticate(user=self.otro_inspector)
        respuesta = self.cliente.post(self.url, format="json")

        self.assertEqual(respuesta.status_code, 400)
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

    # Rechazar a un inspector cuyo perfil esté inactivo.
    def test_rechaza_inspector_inactivo(self):
        self.inspector.perfil.activo = False
        self.inspector.perfil.save(update_fields=["activo"])

        self.cliente.force_authenticate(user=self.inspector)
        respuesta = self.cliente.post(self.url, format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

    # Impedir terminar la inspección dos veces.
    def test_rechaza_segundo_termino(self):
        self.cliente.force_authenticate(user=self.inspector)

        primera = self.cliente.post(self.url, format="json")
        segunda = self.cliente.post(self.url, format="json")

        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 400)

        # El historial debe registrar solamente un término.
        self.assertEqual(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                accion="Inspección SDI terminada"
            ).count(),
            1
        )

    # Impedir terminar la inspección con productos pendientes.
    def test_rechaza_productos_pendientes(self):
        self.item.resultado_actual = ItemSDI.Resultado.PENDIENTE
        self.item.save(update_fields=["resultado_actual"])

        self.cliente.force_authenticate(user=self.inspector)
        respuesta = self.cliente.post(self.url, format="json")

        self.assertEqual(respuesta.status_code, 400)
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)
# =========================================================
# PRUEBA 6 - TÉRMINO FORMAL DE INSPECCIÓN SDI
# =========================================================
class TerminarInspeccionSDITests(TestCase):

    # Preparar inspectores, una SDI en proceso y un producto.
    def setUp(self):
        User = get_user_model()

        self.inspector = User.objects.create_user(
            username="inspector_termino",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.otro_inspector = User.objects.create_user(
            username="inspector_termino_ajeno",
            password="ClaveTemporalPrueba123"
        )
        PerfilUsuario.objects.create(
            usuario=self.otro_inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        self.sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="123456",
            numero_sdi="999006",
            fecha_emision=date.today(),
            proyecto="Proyecto de prueba",
            departamento_solicitante="Producción",
            solicitante="Usuario de prueba",
            inspector=self.inspector,
            creado_por=self.inspector,
            estado=SDI.Estado.EN_PROCESO
        )

        self.item = ItemSDI.objects.create(
            sdi=self.sdi,
            orden=1,
            codigo_plano="PL-002",
            articulo="Producto de prueba",
            cantidad_a_inspeccionar=10,
            resultado_actual=ItemSDI.Resultado.APROBADA
        )

    # El inspector asignado puede enviar la SDI a revisión.
    def test_permite_terminar_sdi_con_productos_resueltos(self):
        terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(
            self.sdi.estado,
            SDI.Estado.PENDIENTE_DE_REVISION
        )

        # Confirmar la transición y el usuario en el historial.
        historial = HistorialSDI.objects.get(
            sdi=self.sdi,
            accion="Inspección SDI terminada"
        )
        self.assertEqual(historial.usuario, self.inspector)
        self.assertEqual(historial.estado_anterior, SDI.Estado.EN_PROCESO)
        self.assertEqual(
            historial.estado_nuevo,
            SDI.Estado.PENDIENTE_DE_REVISION
        )

    # Impedir que un inspector ajeno termine la SDI.
    def test_rechaza_inspector_no_asignado(self):
        with self.assertRaises(ValidationError):
            terminar_inspeccion_sdi(self.otro_inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

    # Una SDI pendiente no puede enviarse directamente a revisión.
    def test_rechaza_sdi_no_iniciada(self):
        self.sdi.estado = SDI.Estado.PENDIENTE
        self.sdi.save(update_fields=["estado"])

        with self.assertRaises(ValidationError):
            terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE)

    # Impedir terminar si quedan productos pendientes.
    def test_rechaza_productos_pendientes(self):
        self.item.resultado_actual = ItemSDI.Resultado.PENDIENTE
        self.item.save(update_fields=["resultado_actual"])

        with self.assertRaises(ValidationError):
            terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

    # Impedir terminar una SDI sin productos.
    def test_rechaza_sdi_sin_productos(self):
        self.item.delete()

        with self.assertRaises(ValidationError):
            terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

    # Impedir terminar dos veces la misma SDI.
    def test_rechaza_segundo_termino(self):
        terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        # El segundo intento debe generar un error de validación.
        with self.assertRaises(ValidationError):
            terminar_inspeccion_sdi(self.inspector, self.sdi.id)
        # Solo debe existir un registro de término.
        self.assertEqual(
            HistorialSDI.objects.filter(
                sdi=self.sdi,
                accion="Inspección SDI terminada"
            ).count(),
            1
        )

    # Impedir que un inspector con perfil inactivo termine la SDI.
    def test_rechaza_inspector_inactivo(self):
        self.inspector.perfil.activo = False
        self.inspector.perfil.save(update_fields=["activo"])

        with self.assertRaises(PermissionDenied):
            terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

    # Impedir el término si existe una inspección abierta.
    def test_rechaza_inspecciones_abiertas(self):
        InspeccionSDI.objects.create(
            item=self.item,
            numero_inspeccion=1,
            inspector=self.inspector,
            cantidad_inspeccionada=10,
            resultado=InspeccionSDI.Resultado.EN_PROCESO
        )

        with self.assertRaisesMessage(
            ValidationError,
            "existe una inspección en proceso"
        ):
            terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

    # Impedir el término si una concesión sigue pendiente.
    def test_rechaza_concesiones_pendientes(self):
        inspeccion = InspeccionSDI.objects.create(
            item=self.item,
            numero_inspeccion=1,
            inspector=self.inspector,
            cantidad_inspeccionada=10,
            resultado=InspeccionSDI.Resultado.CONCESION
        )

        ConcesionSDI.objects.create(
            inspeccion=inspeccion,
            decision=ConcesionSDI.Decision.SOLICITADA,
            responsable_ingenieria="Ingeniería de prueba",
            justificacion="Pendiente de evaluación técnica",
            registrado_por=self.inspector
        )

        with self.assertRaisesMessage(
            ValidationError,
            "concesión pendiente de decisión"
        ):
            terminar_inspeccion_sdi(self.inspector, self.sdi.id)

        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.EN_PROCESO)

# =========================================================
# PASO 50.22 - PRUEBAS DE REVISIÓN FORMAL DE CALIDAD
# =========================================================
class AceptarRevisionSDITests(TestCase):

    def setUp(self):
        User = get_user_model()

        # Crear los usuarios que participan en el flujo.
        self.supervisor = User.objects.create_user(
            username="supervisor_revision",
            password="ClaveTemporalPrueba123"
        )
        self.inspector = User.objects.create_user(
            username="inspector_revision",
            password="ClaveTemporalPrueba123"
        )

        # Asignar los roles reales del sistema.
        PerfilUsuario.objects.create(
            usuario=self.supervisor,
            rol=PerfilUsuario.Rol.SUPERVISOR,
            activo=True
        )
        PerfilUsuario.objects.create(
            usuario=self.inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

        # Preparar una SDI que espera revisión de jefatura.
        self.sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="654321",
            numero_sdi="900001",
            fecha_emision=date.today(),
            proyecto="Prueba de revisión",
            departamento_solicitante="Calidad",
            solicitante="Solicitante de prueba",
            inspector=self.inspector,
            creado_por=self.supervisor,
            estado=SDI.Estado.PENDIENTE_DE_REVISION
        )

        # Crear un producto con resultado técnico aprobado.
        self.item = ItemSDI.objects.create(
            sdi=self.sdi,
            orden=1, #campo obligatorio definido en PostgreSQL
            articulo="Artículo de prueba",
            codigo_plano="PL-900001",
            cantidad_a_inspeccionar=10,
            resultado_actual=ItemSDI.Resultado.APROBADA
        )

        # Registrar el ingreso al ciclo de revisión.
        HistorialSDI.objects.create(
            sdi=self.sdi,
            usuario=self.inspector,
            accion="SDI enviada a revisión",
            estado_anterior=SDI.Estado.EN_PROCESO,
            estado_nuevo=SDI.Estado.PENDIENTE_DE_REVISION
        )

    # La jefatura puede aceptar el resultado técnico.
    def test_supervisor_acepta_resultado(self):
        revision = aceptar_revision_sdi(
            self.sdi.id,
            self.supervisor,
            "Resultado técnico verificado."
        )

        self.assertEqual(revision.decision, RevisionSDI.Decision.ACEPTAR)
        self.assertEqual(revision.revisado_por, self.supervisor)

        self.sdi.refresh_from_db()
        self.item.refresh_from_db()

        # La aceptación no debe cerrar ni alterar la SDI.
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE_DE_REVISION)
        self.assertEqual(self.item.resultado_actual, ItemSDI.Resultado.APROBADA)

        # Comprobar que la decisión quedó registrada en Trazabilidad.
        self.assertTrue(HistorialSDI.objects.filter(
            sdi=self.sdi,
            accion="Resultado técnico aceptado por jefatura",
            usuario=self.supervisor
        ).exists())

    # Impedir que un inspector tome decisiones de jefatura.
    def test_inspector_no_puede_aceptar(self):
        with self.assertRaises(PermissionDenied):
            aceptar_revision_sdi(self.sdi.id, self.inspector)

        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # La revisión exige que el inspector haya enviado la SDI.
    def test_rechazar_sdi_no_pendiente_revision(self):
        self.sdi.estado = SDI.Estado.EN_PROCESO
        self.sdi.save(update_fields=["estado"])

        with self.assertRaisesMessage(ValidationError, "no está pendiente"):
            aceptar_revision_sdi(self.sdi.id, self.supervisor)

    # No se puede aceptar dos veces el mismo ciclo de revisión.
    def test_no_duplicar_aceptacion(self):
        aceptar_revision_sdi(self.sdi.id, self.supervisor)

        with self.assertRaisesMessage(ValidationError, "ya tiene una decisión"):
            aceptar_revision_sdi(self.sdi.id, self.supervisor)

    # PASO 50.30 - Impedir aceptar una inspección todavía activa.
    def test_rechaza_inspeccion_en_proceso(self):
        InspeccionSDI.objects.create(
            item=self.item,
            numero_inspeccion=1,
            inspector=self.inspector,
            cantidad_inspeccionada=10,
            resultado=InspeccionSDI.Resultado.EN_PROCESO,
        )

        with self.assertRaisesMessage(ValidationError, "todavía en proceso"):
            aceptar_revision_sdi(self.sdi.id, self.supervisor)

        # No debe registrarse ninguna decisión de aceptación.
        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # PASO 50.30 - Impedir aceptar una concesión sin resolver.
    def test_rechaza_concesion_pendiente(self):
        inspeccion = InspeccionSDI.objects.create(
            item=self.item,
            numero_inspeccion=1,
            inspector=self.inspector,
            cantidad_inspeccionada=10,
            resultado=InspeccionSDI.Resultado.CONCESION,
        )

        ConcesionSDI.objects.create(
            inspeccion=inspeccion,
            decision=ConcesionSDI.Decision.SOLICITADA,
            responsable_ingenieria="Ingeniería de prueba",
            justificacion="Pendiente de resolución técnica",
            registrado_por=self.inspector,
        )

        with self.assertRaisesMessage(ValidationError, "concesiones pendientes"):
            aceptar_revision_sdi(self.sdi.id, self.supervisor)

        # La concesión original debe conservarse sin modificaciones.
        self.assertTrue(ConcesionSDI.objects.filter(
            inspeccion=inspeccion,
            decision=ConcesionSDI.Decision.SOLICITADA
        ).exists())
        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # PASO 50.32 - Permitir una nueva aceptación en otro ciclo de revisión.
    def test_permite_aceptar_segundo_ciclo_revision(self):
        # Registrar la aceptación del primer ciclo.
        primera_revision = aceptar_revision_sdi(
            self.sdi.id,
            self.supervisor,
            "Primera revisión aceptada."
        )

        # Simular que la SDI regresa a inspección.
        self.sdi.estado = SDI.Estado.EN_PROCESO
        self.sdi.save(update_fields=["estado"])

        # Registrar el segundo envío a revisión por el inspector.
        HistorialSDI.objects.create(
            sdi=self.sdi,
            usuario=self.inspector,
            accion="SDI enviada nuevamente a revisión",
            estado_anterior=SDI.Estado.EN_PROCESO,
            estado_nuevo=SDI.Estado.PENDIENTE_DE_REVISION,
        )

        # Devolver la SDI al estado pendiente de revisión.
        self.sdi.estado = SDI.Estado.PENDIENTE_DE_REVISION
        self.sdi.save(update_fields=["estado"])

        # La nueva aceptación no debe considerarse duplicada.
        segunda_revision = aceptar_revision_sdi(
            self.sdi.id,
            self.supervisor,
            "Segunda revisión aceptada."
        )

        # Comprobar que ambas decisiones siguen registradas.
        self.assertNotEqual(primera_revision.id, segunda_revision.id)
        self.assertEqual(
            RevisionSDI.objects.filter(
                sdi=self.sdi,
                decision=RevisionSDI.Decision.ACEPTAR
            ).count(),
            2
        )

        # La SDI debe continuar pendiente de cierre administrativo.
        self.sdi.refresh_from_db()
        self.assertEqual(
            self.sdi.estado,
            SDI.Estado.PENDIENTE_DE_REVISION
        )

    # PASO 50.39 - Verificar el rechazo administrativo del resultado técnico.
    def test_supervisor_no_acepta_resultado(self):
        revision = no_aceptar_revision_sdi(
            self.sdi.id,
            self.supervisor,
            "Las evidencias requieren una nueva revisión."
        )

        # Comprobar que la decisión quedó registrada.
        self.assertEqual(revision.decision, RevisionSDI.Decision.NO_ACEPTAR)
        self.assertEqual(revision.revisado_por, self.supervisor)

        # Conservar el estado y el resultado original del inspector.
        self.sdi.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE_DE_REVISION)
        self.assertEqual(self.item.resultado_actual, ItemSDI.Resultado.APROBADA)

        # Registrar el desacuerdo en la trazabilidad.
        self.assertTrue(HistorialSDI.objects.filter(
            sdi=self.sdi,
            accion="Resultado técnico no aceptado por jefatura"
        ).exists())

    # Exigir una justificación antes de registrar el desacuerdo.
    def test_no_aceptar_exige_observaciones(self):
        with self.assertRaisesMessage(ValidationError, "Debe indicar el motivo"):
            no_aceptar_revision_sdi(self.sdi.id, self.supervisor, "   ")

        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # Prohibir que el inspector registre decisiones administrativas.
    def test_inspector_no_puede_rechazar_revision(self):
        with self.assertRaises(PermissionDenied):
            no_aceptar_revision_sdi(
                self.sdi.id,
                self.inspector,
                "No corresponde aceptar."
            )

        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # Impedir duplicar una decisión administrativa en el mismo ciclo.
    def test_no_duplicar_desacuerdo(self):
        no_aceptar_revision_sdi(
            self.sdi.id,
            self.supervisor,
            "Primera observación."
        )

        with self.assertRaisesMessage(ValidationError, "ya tiene una decisión"):
            no_aceptar_revision_sdi(
                self.sdi.id,
                self.supervisor,
                "Segunda observación."
            )

    # PASO 50.41 - Impedir decisiones contradictorias en el mismo ciclo.
    def test_no_permite_aceptar_despues_de_desacuerdo(self):
        # Jefatura registra primero que no acepta el resultado.
        no_aceptar_revision_sdi(
            self.sdi.id,
            self.supervisor,
            "Se requieren nuevas evidencias técnicas."
        )

        # No permitir aceptar sin un nuevo ciclo de inspección.
        with self.assertRaisesMessage(
            ValidationError,
            "ya tiene una decisión"
        ):
            aceptar_revision_sdi(
                self.sdi.id,
                self.supervisor,
                "Aceptar sin nueva evaluación."
            )

        # Conservar únicamente la decisión original.
        self.assertEqual(
            RevisionSDI.objects.filter(sdi=self.sdi).count(),
            1
        )

        self.assertEqual(
            RevisionSDI.objects.get(sdi=self.sdi).decision,
            RevisionSDI.Decision.NO_ACEPTAR
        )

    # PASO 50.58 - Registrar solicitud sin iniciar otra inspección.
    def test_supervisor_solicita_reinspeccion_sin_iniciarla(self):
        # Preparar una inspección anterior con resultado rechazado.
        inspeccion_anterior = InspeccionSDI.objects.create(
            item=self.item,
            numero_inspeccion=1,
            inspector=self.inspector,
            cantidad_inspeccionada=10,
            resultado=InspeccionSDI.Resultado.RECHAZADA,
        )

        # Ajustar el resultado del producto a la evaluación anterior.
        self.item.resultado_actual = ItemSDI.Resultado.RECHAZADA
        self.item.save(update_fields=["resultado_actual"])

        # Registrar la solicitud administrativa de jefatura.
        revision = solicitar_reinspeccion_revision_sdi(
            self.sdi.id,
            self.item.id,
            self.supervisor,
            "Solicitar una nueva inspección del producto rechazado."
        )

        # Comprobar la decisión y su producto asociado.
        self.assertEqual(revision.decision, RevisionSDI.Decision.REINSPECCION)
        self.assertEqual(revision.item_id, self.item.id)
        self.assertEqual(revision.revisado_por, self.supervisor)

        # La solicitud no debe crear un nuevo intento automáticamente.
        self.assertEqual(InspeccionSDI.objects.filter(item=self.item).count(), 1)

        # Conservar intacta la inspección original.
        inspeccion_anterior.refresh_from_db()
        self.assertEqual(inspeccion_anterior.resultado, InspeccionSDI.Resultado.RECHAZADA)

        # Registrar el evento en la trazabilidad.
        self.assertTrue(HistorialSDI.objects.filter(
            sdi=self.sdi,
            item=self.item,
            accion="Reinspección solicitada por jefatura"
        ).exists())

        # La solicitud no debe cerrar administrativamente la SDI.
        self.sdi.refresh_from_db()
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE_DE_REVISION)

    # PASO 50.61 - Impedir solicitudes de reinspección realizadas por inspectores.
    def test_inspector_no_puede_solicitar_reinspeccion(self):
        # Preparar una inspección anterior finalizada.
        InspeccionSDI.objects.create(
            item=self.item,
            numero_inspeccion=1,
            inspector=self.inspector,
            cantidad_inspeccionada=10,
            resultado=InspeccionSDI.Resultado.RECHAZADA,
        )
        self.item.resultado_actual = ItemSDI.Resultado.RECHAZADA
        self.item.save(update_fields=["resultado_actual"])

        # Solo jefatura puede solicitar una reinspección.
        with self.assertRaises(PermissionDenied):
            solicitar_reinspeccion_revision_sdi(
                self.sdi.id,
                self.item.id,
                self.inspector,
                "Se solicita una nueva inspección."
            )

        # No registrar decisiones sin autorización.
        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # PASO 50.61 - Exigir una justificación de jefatura.
    def test_reinspeccion_exige_observaciones(self):
        with self.assertRaisesMessage(
            ValidationError,
            "Debe indicar el motivo"
        ):
            solicitar_reinspeccion_revision_sdi(
                self.sdi.id,
                self.item.id,
                self.supervisor,
                "   "
            )

        # No guardar solicitudes sin una justificación válida.
        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # PASO 50.62 - Impedir reinspecciones de productos ajenos a la SDI.
    def test_reinspeccion_rechaza_producto_de_otra_sdi(self):
        # Crear otra SDI independiente para comprobar la pertenencia.
        otra_sdi = SDI.objects.create(
            prefijo_bod=False,
            activacion_proyecto="654322",
            numero_sdi="900002",
            fecha_emision=date.today(),
            proyecto="Otra SDI de prueba",
            departamento_solicitante="Calidad",
            solicitante="Solicitante de prueba",
            inspector=self.inspector,
            creado_por=self.supervisor,
            estado=SDI.Estado.PENDIENTE_DE_REVISION,
        )

        # Crear un producto perteneciente únicamente a la segunda SDI.
        otro_item = ItemSDI.objects.create(
            sdi=otra_sdi,
            orden=1,  # Campo obligatorio del producto.
            articulo="Producto de otra SDI",
            codigo_plano="PL-900002",
            cantidad_a_inspeccionar=10,
            resultado_actual=ItemSDI.Resultado.RECHAZADA,
        )

        # No permitir asociar el producto ajeno a la primera SDI.
        with self.assertRaisesMessage(
            ValidationError,
            "no pertenece a esta SDI"
        ):
            solicitar_reinspeccion_revision_sdi(
                self.sdi.id,
                otro_item.id,
                self.supervisor,
                "Revisar producto de otra solicitud."
            )

        self.assertFalse(RevisionSDI.objects.filter(sdi=self.sdi).exists())

    # PASO 50.62 - Impedir solicitudes duplicadas durante el mismo ciclo.
    def test_no_duplicar_solicitud_reinspeccion(self):
        # Preparar una inspección original rechazada.
        InspeccionSDI.objects.create(
            item=self.item,
            numero_inspeccion=1,
            inspector=self.inspector,
            cantidad_inspeccionada=10,
            resultado=InspeccionSDI.Resultado.RECHAZADA,
        )
        self.item.resultado_actual = ItemSDI.Resultado.RECHAZADA
        self.item.save(update_fields=["resultado_actual"])

        # Registrar la primera solicitud de jefatura.
        solicitar_reinspeccion_revision_sdi(
            self.sdi.id,
            self.item.id,
            self.supervisor,
            "Primera solicitud de reinspección."
        )

        # La segunda solicitud del mismo ciclo debe rechazarse.
        with self.assertRaisesMessage(
            ValidationError,
            "ya tiene una decisión"
        ):
            solicitar_reinspeccion_revision_sdi(
                self.sdi.id,
                self.item.id,
                self.supervisor,
                "Solicitud repetida."
            )

        # Debe conservarse únicamente la solicitud original.
        self.assertEqual(
            RevisionSDI.objects.filter(
                sdi=self.sdi,
                decision=RevisionSDI.Decision.REINSPECCION,
            ).count(),
            1
        )
