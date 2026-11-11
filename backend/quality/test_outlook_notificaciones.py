
from contextlib import nullcontext  # Simula el contexto transaccional sin PostgreSQL.
from unittest.mock import MagicMock, patch  # Simula dependencias externas.
from django.core.exceptions import ValidationError  # Comprueba errores controlados.
from django.test import SimpleTestCase, override_settings  # Pruebas sin base de datos.

from quality.models import NotificacionSDI  # Estados existentes del sistema.
from quality.integraciones.outlook_notificaciones import (
    obtener_destinatario,
    preparar_notificacion,
    enviar_notificacion_outlook,
)


@override_settings(
    SDI_CORREOS_DEPARTAMENTOS={
        "Calidad": "calidad@example.com",
        "Producción": "produccion@example.com",
        "Bodega": "bodega@example.com",
    },
    MS365_TENANT_ID="tenant-prueba",
    MS365_CLIENT_ID="cliente-prueba",
    MS365_CLIENT_SECRET="secreto-simulado",
    MS365_MAILBOX="buzon@example.com",
    MS365_GRAPH_URL="https://graph.microsoft.com/v1.0",
)
class OutlookNotificacionesTests(SimpleTestCase):
    """Valida las notificaciones sin conexiones ni correos reales."""

    def setUp(self):
        # Preparar una notificación simulada sin consultar PostgreSQL.
        self.notificacion = MagicMock()
        self.notificacion.pk = 123
        self.notificacion.departamento_destinatario = "Calidad"
        self.notificacion.correo_destinatario = ""
        self.notificacion.asunto = "SDI de prueba"
        self.notificacion.mensaje = "Mensaje de notificación de prueba."
        self.notificacion.estado_envio = NotificacionSDI.EstadoEnvio.PENDIENTE

    def test_destinatarios_por_departamento(self):
        # Verificar las tres direcciones configuradas.
        departamentos = {
            "Calidad": "calidad@example.com",
            "Producción": "produccion@example.com",
            "Bodega": "bodega@example.com",
        }

        for departamento, correo in departamentos.items():
            with self.subTest(departamento=departamento):
                self.notificacion.departamento_destinatario = departamento
                self.assertEqual(
                    obtener_destinatario(self.notificacion), correo
                )

    def test_prioridad_correo_especifico(self):
        # Un correo específico autorizado prevalece sobre el del departamento.
        self.notificacion.correo_destinatario = "solicitante@example.com"

        self.assertEqual(
            obtener_destinatario(self.notificacion),
            "solicitante@example.com",
        )

    def test_rechaza_destinatario_invalido(self):
        # Impedir envíos cuando no hay una dirección válida.
        self.notificacion.correo_destinatario = "correo-invalido"

        with self.assertRaises(ValidationError):
            obtener_destinatario(self.notificacion)

    def test_prepara_mensaje_para_graph(self):
        # Simular la consulta de la notificación.
        with patch(
            "quality.integraciones.outlook_notificaciones.NotificacionSDI.objects.get",
            return_value=self.notificacion,
        ):
            mensaje = preparar_notificacion(123)

        # Comprobar destinatario, asunto y contenido.
        self.assertEqual(mensaje["message"]["subject"], "SDI de prueba")
        self.assertEqual(
            mensaje["message"]["toRecipients"][0]["emailAddress"]["address"],
            "calidad@example.com",
        )
        self.assertEqual(
            mensaje["message"]["body"]["contentType"], "Text"
        )
        self.assertTrue(mensaje["saveToSentItems"])

    def test_envio_bloqueado_por_defecto(self):
        # El servicio nunca debe enviar sin autorización explícita.
        with patch(
            "quality.integraciones.outlook_notificaciones.requests.post"
        ) as solicitud:
            with self.assertRaises(ValidationError):
                enviar_notificacion_outlook(123)

            solicitud.assert_not_called()

    def test_graph_acepta_envio_simulado(self):
        # Simular PostgreSQL, autenticación y respuesta de Microsoft Graph.
        with (
            patch(
                "quality.integraciones.outlook_notificaciones.transaction.atomic",
                return_value=nullcontext(),
            ),
            patch(
                "quality.integraciones.outlook_notificaciones.NotificacionSDI.objects.select_for_update"
            ) as consulta,
            patch(
                "quality.integraciones.outlook_notificaciones.NotificacionSDI.objects.get",
                return_value=self.notificacion,
            ),
            patch(
                "quality.integraciones.outlook_notificaciones.obtener_token_outlook",
                return_value="token-simulado",
            ),
            patch(
                "quality.integraciones.outlook_notificaciones.requests.post"
            ) as solicitud,
        ):
            consulta.return_value.get.return_value = self.notificacion
            solicitud.return_value.status_code = 202

            resultado = enviar_notificacion_outlook(
                123, habilitar_envio=True
            )

            # Comprobar aceptación y actualización del registro simulado.
            self.assertEqual(resultado["estado"], "aceptada_por_graph")
            self.assertEqual(
                self.notificacion.estado_envio,
                NotificacionSDI.EstadoEnvio.ENVIADA,
            )
            self.notificacion.save.assert_called_once()
            solicitud.assert_called_once()

    def test_no_reenvia_notificacion_enviada(self):
        # No permitir un segundo envío de una notificación ya procesada.
        self.notificacion.estado_envio = NotificacionSDI.EstadoEnvio.ENVIADA

        with (
            patch(
                "quality.integraciones.outlook_notificaciones.transaction.atomic",
                return_value=nullcontext(),
            ),
            patch(
                "quality.integraciones.outlook_notificaciones.NotificacionSDI.objects.select_for_update"
            ) as consulta,
            patch(
                "quality.integraciones.outlook_notificaciones.requests.post"
            ) as solicitud,
        ):
            consulta.return_value.get.return_value = self.notificacion

            with self.assertRaises(ValidationError):
                enviar_notificacion_outlook(123, habilitar_envio=True)

            solicitud.assert_not_called()
