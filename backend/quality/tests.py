
from datetime import date  # Fecha de emisión de la SDI.

from django.contrib.auth import get_user_model  # Modelo de usuario.
from django.core.exceptions import ValidationError  # Errores de validación.
from django.test import TestCase  # Pruebas automatizadas.

from .models import HistorialSDI, PerfilUsuario, SDI  # Modelos necesarios.
from .services import cerrar_sdi, crear_sdi  # Servicios que se probarán.


# =========================================================
# PRUEBA 1 - CREACIÓN DE UNA SDI
# =========================================================

class CrearSDITests(TestCase):

    # Preparar un supervisor y un inspector activo.
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

        self.inspector = User.objects.create_user(
            username="inspector_creacion",
            password="ClaveTemporalPrueba123"
        )

        PerfilUsuario.objects.create(
            usuario=self.inspector,
            rol=PerfilUsuario.Rol.INSPECTOR,
            activo=True
        )

    # Verificar que una SDI con inspector se cree EN_PROCESO.
    def test_crear_sdi_con_inspector_en_proceso(self):
        sdi = crear_sdi(
            usuario_actual=self.supervisor,
            inspector=self.inspector,
            activacion_proyecto="123456",
            numero_sdi="999002",
            fecha_emision=date.today(),
            proyecto="Proyecto de prueba",
            departamento_solicitante="Calidad",
            solicitante="Usuario de prueba"
        )

        # Comprobar el estado guardado en la base de pruebas.
        sdi.refresh_from_db()
        self.assertEqual(
            sdi.estado,
            SDI.Estado.EN_PROCESO
        )

        # Confirmar que el inspector quedó asignado.
        self.assertEqual(
            sdi.inspector,
            self.inspector
        )

        # Comprobar que el historial registre la creación.
        historial = HistorialSDI.objects.get(
            sdi=sdi,
            accion="SDI creada"
        )

        # Confirmar que el historial registre EN_PROCESO.
        self.assertEqual(
            historial.estado_nuevo,
            SDI.Estado.EN_PROCESO
        )


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
