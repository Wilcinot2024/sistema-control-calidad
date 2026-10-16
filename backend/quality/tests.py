from django.test import TestCase

# Create your tests here.
from datetime import date  # Fecha de emisión de la SDI.

from django.contrib.auth import get_user_model  # Modelo de usuario.
from django.core.exceptions import ValidationError  # Errores de validación.
from django.test import TestCase  # Pruebas automatizadas.

from .models import PerfilUsuario, SDI  # Modelos necesarios.
from .services import cerrar_sdi  # Servicio que se probará.


class CerrarSDITests(TestCase):

    # Crear los datos necesarios para la prueba.
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

        # Confirmar que la SDI conserva su estado.
        self.sdi.refresh_from_db()
        self.assertEqual(
            self.sdi.estado,
            SDI.Estado.CERRADA
        )