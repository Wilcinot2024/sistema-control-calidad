
from datetime import date  # Fecha ficticia de la SDI.
from unittest.mock import patch  # Simula el importador existente.

from django.core.exceptions import ValidationError  # Errores de validación.
from django.test import TestCase  # Base de datos aislada para pruebas.

from quality.models import SDI, RecepcionOutlookSDI  # Modelos necesarios.
from quality.integraciones.outlook_recepcion import procesar_pdf_recibido  # Servicio.


class RecepcionOutlookTests(TestCase):
    """Pruebas de recepción sin conexión real a Outlook."""

    def setUp(self):
        self.datos = {
            "contenido_pdf": b"%PDF-1.4 documento de prueba",
            "buzon": "calidad@empresa.cl",
            "mensaje_id": "mensaje-prueba-001",
            "nombre_archivo": "SDI-PRUEBA.pdf",
            "usuario_actual": None,
            "departamento_solicitante": "Producción",
            "solicitante": "Solicitante de prueba",
        }

    def crear_sdi_prueba(self):
        """Crea una SDI ficticia en la base de datos de pruebas."""
        return SDI.objects.create(
            prefijo_bod=False,  # SDI ficticia sin prefijo BOD.
            activacion_proyecto="990001",  # Código ficticio de seis caracteres.
            numero_sdi="999991",
            fecha_emision=date(2026, 11, 11),
            proyecto="Proyecto de prueba Outlook",
            departamento_solicitante="Producción",
            solicitante="Solicitante de prueba",
        )
    @patch("quality.integraciones.outlook_recepcion.importar_sdi_desde_pdf")
    def test_importacion_correcta(self, importar):
        """Registra la recepción al importar correctamente una SDI."""
        sdi = self.crear_sdi_prueba()
        importar.return_value = sdi

        resultado = procesar_pdf_recibido(**self.datos)

        self.assertEqual(resultado["estado"], "procesado")
        self.assertEqual(resultado["sdi_id"], sdi.pk)
        self.assertEqual(RecepcionOutlookSDI.objects.count(), 1)

        recepcion = RecepcionOutlookSDI.objects.get()
        self.assertEqual(recepcion.sdi_id, sdi.pk)
        self.assertEqual(recepcion.estado, RecepcionOutlookSDI.Estado.PROCESADO)
        importar.assert_called_once()

    @patch("quality.integraciones.outlook_recepcion.importar_sdi_desde_pdf")
    def test_documento_duplicado(self, importar):
        """El segundo procesamiento no importa nuevamente el PDF."""
        sdi = self.crear_sdi_prueba()
        importar.return_value = sdi

        primero = procesar_pdf_recibido(**self.datos)
        segundo = procesar_pdf_recibido(**self.datos)

        self.assertEqual(primero["estado"], "procesado")
        self.assertEqual(segundo["estado"], "duplicado")
        self.assertEqual(RecepcionOutlookSDI.objects.count(), 1)
        importar.assert_called_once()

    def test_pdf_invalido(self):
        """Rechaza contenido que no tenga firma PDF."""
        self.datos["contenido_pdf"] = b"contenido no valido"

        with self.assertRaises(ValidationError):
            procesar_pdf_recibido(**self.datos)

        self.assertEqual(RecepcionOutlookSDI.objects.count(), 0)

    @patch("quality.integraciones.outlook_recepcion.importar_sdi_desde_pdf")
    def test_error_importacion(self, importar):
        """Una importación fallida no registra un PDF procesado."""
        importar.side_effect = ValidationError("Error simulado")

        with self.assertRaises(ValidationError):
            procesar_pdf_recibido(**self.datos)

        self.assertEqual(RecepcionOutlookSDI.objects.count(), 0)

    @patch("quality.integraciones.outlook_recepcion.importar_sdi_desde_pdf")
    def test_reversion_transaccion(self, importar):
        """Revierte una SDI creada cuando el importador falla después."""
        def importar_con_error(**kwargs):
            self.crear_sdi_prueba()
            raise ValidationError("Fallo posterior a la creación")

        importar.side_effect = importar_con_error

        with self.assertRaises(ValidationError):
            procesar_pdf_recibido(**self.datos)

        self.assertEqual(SDI.objects.count(), 0)
        self.assertEqual(RecepcionOutlookSDI.objects.count(), 0)
