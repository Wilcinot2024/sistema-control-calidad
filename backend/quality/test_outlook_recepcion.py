from django.contrib.auth import get_user_model  # Crea usuarios ficticios para las pruebas.
from datetime import date  # Fecha ficticia de la SDI.
from unittest.mock import patch  # Simula el importador existente.
from django.core.exceptions import ValidationError  # Errores de validación.
from django.test import TestCase  # Base de datos aislada para pruebas.
from django.test import override_settings  # Simula remitentes autorizados.
from quality.models import SDI, RecepcionOutlookSDI, PerfilUsuario  # Modelos utilizados en las pruebas.
from quality.integraciones.outlook_recepcion import (
    procesar_pdf_recibido,                # Importa y registra documentos PDF.
    identificar_departamento_remitente,  # Verifica el departamento del remitente.
    obtener_usuario_servicio_outlook,    # Valida la cuenta técnica autorizada.
    procesar_mensaje_outlook,            # Coordina el procesamiento de mensajes.
)
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

@override_settings(SDI_REMITENTES_AUTORIZADOS={
    "Calidad": ["calidad@empresa.cl"],
    "Producción": ["produccion@empresa.cl"],
    "Bodega": ["bodega@empresa.cl"],
})
class AutorizacionRemitentesTests(TestCase):
    """Comprueba el departamento del remitente sin consultar Outlook."""

    def crear_mensaje(self, correo):
        """Construye un mensaje simulado con el formato de Microsoft Graph."""
        return {
            "from": {
                "emailAddress": {
                    "address": correo,
                }
            }
        }

    def test_remitente_calidad(self):
        """Reconoce un remitente autorizado de Calidad."""
        resultado = identificar_departamento_remitente(
            self.crear_mensaje("calidad@empresa.cl")
        )
        self.assertEqual(resultado, "Calidad")

    def test_remitente_produccion(self):
        """Reconoce un remitente autorizado de Producción."""
        resultado = identificar_departamento_remitente(
            self.crear_mensaje("PRODUCCION@EMPRESA.CL")
        )
        self.assertEqual(resultado, "Producción")

    def test_remitente_bodega(self):
        """Reconoce un remitente autorizado de Bodega."""
        resultado = identificar_departamento_remitente(
            self.crear_mensaje("bodega@empresa.cl")
        )
        self.assertEqual(resultado, "Bodega")

    def test_remitente_desconocido(self):
        """Rechaza una dirección no configurada."""
        with self.assertRaises(ValidationError):
            identificar_departamento_remitente(
                self.crear_mensaje("desconocido@empresa.cl")
            )

    def test_remitente_vacio(self):
        """Rechaza mensajes que no indican remitente."""
        with self.assertRaises(ValidationError):
            identificar_departamento_remitente(
                self.crear_mensaje("")
            )

    @override_settings(SDI_REMITENTES_AUTORIZADOS={
        "Calidad": ["compartido@empresa.cl"],
        "Producción": ["compartido@empresa.cl"],
        "Bodega": [],
    })
    def test_remitente_departamento_ambiguo(self):
        """Rechaza una dirección asignada a dos departamentos."""
        with self.assertRaises(ValidationError):
            identificar_departamento_remitente(
                self.crear_mensaje("compartido@empresa.cl")
            )

class UsuarioServicioOutlookTests(TestCase):
    """Comprueba los permisos de la cuenta técnica sin utilizar usuarios reales."""

    def setUp(self):
        # Crear una cuenta ficticia únicamente en la base de pruebas.
        modelo_usuario = get_user_model()
        self.usuario = modelo_usuario.objects.create_user(
            username="servicio_outlook_prueba",
            password="ClaveTemporalSoloParaPruebas123!",
        )
        self.perfil = PerfilUsuario.objects.create(
            usuario=self.usuario,
            rol=PerfilUsuario.Rol.SUPERVISOR,
            activo=True,
        )

    @override_settings(SDI_USUARIO_SERVICIO_OUTLOOK="servicio_outlook_prueba")
    def test_usuario_autorizado(self):
        """Acepta una cuenta activa con perfil y rol permitidos."""
        resultado = obtener_usuario_servicio_outlook()
        self.assertEqual(resultado.pk, self.usuario.pk)

    @override_settings(SDI_USUARIO_SERVICIO_OUTLOOK="")
    def test_usuario_no_configurado(self):
        """Rechaza una configuración sin cuenta técnica."""
        with self.assertRaises(ValidationError):
            obtener_usuario_servicio_outlook()

    @override_settings(SDI_USUARIO_SERVICIO_OUTLOOK="usuario_inexistente")
    def test_usuario_inexistente(self):
        """Rechaza una cuenta que no existe."""
        with self.assertRaises(ValidationError):
            obtener_usuario_servicio_outlook()

    @override_settings(SDI_USUARIO_SERVICIO_OUTLOOK="servicio_outlook_prueba")
    def test_usuario_inactivo(self):
        """Rechaza cuentas Django deshabilitadas."""
        self.usuario.is_active = False
        self.usuario.save(update_fields=["is_active"])

        with self.assertRaises(ValidationError):
            obtener_usuario_servicio_outlook()

    @override_settings(SDI_USUARIO_SERVICIO_OUTLOOK="servicio_outlook_prueba")
    def test_perfil_inactivo(self):
        """Rechaza usuarios cuyo perfil está deshabilitado."""
        self.perfil.activo = False
        self.perfil.save(update_fields=["activo"])

        with self.assertRaises(ValidationError):
            obtener_usuario_servicio_outlook()
    @override_settings(SDI_USUARIO_SERVICIO_OUTLOOK="servicio_outlook_prueba")
    def test_rol_inspector(self):
        """Impide utilizar una cuenta con rol Inspector."""
        self.perfil.rol = PerfilUsuario.Rol.INSPECTOR
        self.perfil.save(update_fields=["rol"])
        with self.assertRaises(ValidationError):
            obtener_usuario_servicio_outlook()

@override_settings(
    SDI_REMITENTES_AUTORIZADOS={
        "Calidad": ["calidad@empresa.cl"],
        "Producción": ["produccion@empresa.cl"],
        "Bodega": ["bodega@empresa.cl"],
    },
    MS365_MAILBOX="buzon.prueba@empresa.cl",
)
class CoordinadorOutlookTests(TestCase):
    """Prueba el coordinador sin conectarse a Microsoft Graph."""

    def crear_mensaje(self, correo="produccion@empresa.cl"):
        """Construye un mensaje simulado de Outlook."""
        return {
            "id": "mensaje-simulado-001",
            "from": {
                "emailAddress": {
                    "address": correo,
                }
            },
        }

    @patch("quality.integraciones.outlook_recepcion.obtener_adjuntos_outlook")
    def test_importacion_desactivada(self, obtener_adjuntos):
        """El coordinador no consulta adjuntos cuando está desactivado."""
        with self.assertRaises(ValidationError):
            procesar_mensaje_outlook(self.crear_mensaje())

        obtener_adjuntos.assert_not_called()

    @patch("quality.integraciones.outlook_recepcion.obtener_usuario_servicio_outlook")
    @patch("quality.integraciones.outlook_recepcion.obtener_adjuntos_outlook")
    def test_remitente_no_autorizado(self, obtener_adjuntos, obtener_usuario):
        """Rechaza remitentes desconocidos antes de descargar archivos."""
        with self.assertRaises(ValidationError):
            procesar_mensaje_outlook(
                self.crear_mensaje("desconocido@empresa.cl"),
                ejecutar_importacion=True,
            )

        obtener_usuario.assert_not_called()
        obtener_adjuntos.assert_not_called()

    @patch("quality.integraciones.outlook_recepcion.obtener_usuario_servicio_outlook")
    @patch("quality.integraciones.outlook_recepcion.obtener_adjuntos_outlook")
    def test_cuenta_tecnica_invalida(self, obtener_adjuntos, obtener_usuario):
        """Impide descargar archivos si la cuenta técnica es inválida."""
        obtener_usuario.side_effect = ValidationError("Cuenta técnica inválida.")

        with self.assertRaises(ValidationError):
            procesar_mensaje_outlook(
                self.crear_mensaje(),
                ejecutar_importacion=True,
            )

        obtener_adjuntos.assert_not_called()

    @patch("quality.integraciones.outlook_recepcion.procesar_pdf_recibido")
    @patch("quality.integraciones.outlook_recepcion.extraer_pdfs_adjuntos")
    @patch("quality.integraciones.outlook_recepcion.obtener_adjuntos_outlook")
    @patch("quality.integraciones.outlook_recepcion.obtener_usuario_servicio_outlook")
    def test_mensaje_autorizado(
        self, obtener_usuario, obtener_adjuntos, extraer_pdfs, procesar_pdf
    ):
        """Comprueba los parámetros entregados al importador simulado."""
        obtener_usuario.return_value = object()
        obtener_adjuntos.return_value = [{"id": "adjunto-prueba"}]
        extraer_pdfs.return_value = [
            {"nombre": "SDI-PRUEBA.pdf", "contenido": b"%PDF-1.4 prueba"}
        ]
        procesar_pdf.return_value = {"estado": "procesado", "sdi_id": 999}

        resultado = procesar_mensaje_outlook(
            self.crear_mensaje(),
            ejecutar_importacion=True,
        )

        self.assertEqual(resultado["estado"], "procesado")
        self.assertEqual(len(resultado["resultados"]), 1)
        obtener_adjuntos.assert_called_once_with("mensaje-simulado-001")
        procesar_pdf.assert_called_once()

        argumentos = procesar_pdf.call_args.kwargs
        self.assertEqual(argumentos["departamento_solicitante"], "Producción")
        self.assertEqual(argumentos["buzon"], "buzon.prueba@empresa.cl")
        self.assertEqual(argumentos["solicitante"], "produccion@empresa.cl")

    @patch("quality.integraciones.outlook_recepcion.procesar_pdf_recibido")
    @patch("quality.integraciones.outlook_recepcion.extraer_pdfs_adjuntos")
    @patch("quality.integraciones.outlook_recepcion.obtener_adjuntos_outlook")
    @patch("quality.integraciones.outlook_recepcion.obtener_usuario_servicio_outlook")
    def test_error_parcial_continua_con_otros_pdf(
        self, obtener_usuario, obtener_adjuntos, extraer_pdfs, procesar_pdf
    ):
        """Un PDF inválido no impide procesar los documentos siguientes."""

        # Simular una cuenta técnica válida y tres documentos PDF.
        obtener_usuario.return_value = object()
        obtener_adjuntos.return_value = []

        extraer_pdfs.return_value = [
            {"nombre": "SDI-001.pdf", "contenido": b"%PDF-1.4 primero"},
            {"nombre": "SDI-002.pdf", "contenido": b"%PDF-1.4 segundo"},
            {"nombre": "SDI-003.pdf", "contenido": b"%PDF-1.4 tercero"},
        ]

        # El segundo documento falla; el primero y tercero se procesan.
        procesar_pdf.side_effect = [
            {"estado": "procesado", "sdi_id": 101},
            ValidationError("La SDI ya está registrada en el sistema."),
            {"estado": "procesado", "sdi_id": 103},
        ]

        resultado = procesar_mensaje_outlook(
            self.crear_mensaje(),
            ejecutar_importacion=True,
        )

        # Comprobar que se intentaron procesar los tres documentos.
        self.assertEqual(procesar_pdf.call_count, 3)
        self.assertEqual(resultado["estado"], "parcial")
        self.assertEqual(len(resultado["resultados"]), 3)

        # Verificar los resultados individuales.
        self.assertEqual(resultado["resultados"][0]["estado"], "procesado")
        self.assertEqual(resultado["resultados"][1]["estado"], "error")
        self.assertEqual(resultado["resultados"][2]["estado"], "procesado")
        self.assertEqual(resultado["resultados"][1]["archivo"], "SDI-002.pdf")
