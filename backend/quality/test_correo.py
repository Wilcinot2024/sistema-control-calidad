from datetime import timedelta
from email.message import EmailMessage as MensajeMIME
from io import BytesIO, StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

from .correo import consultar_buzon, enviar_avisos, recibir_mensaje
from .models import HistorialSDI, ItemSDI, NotificacionSDI, PerfilUsuario, RecepcionCorreoSDI, SDI
from .services import registrar_notificacion_sdi

SMTP = {"default": {"BACKEND": "django.core.mail.backends.smtp.EmailBackend", "OPTIONS": {"host": "smtp.example.invalid"}}}


def pdf_valido(paginas=1, cifrado=False):
    writer = PdfWriter()
    for _ in range(paginas):
        writer.add_blank_page(width=300, height=300)
    if cifrado:
        writer.encrypt("clave-solo-prueba")
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def mensaje(pdfs=None, remitente="bodega@example.invalid", mensaje_id="<sdi-1@example.invalid>"):
    mail = MensajeMIME()
    mail["From"] = remitente
    mail["To"] = "calidad@example.invalid"
    mail["Message-ID"] = mensaje_id
    mail.set_content("Solicitud de inspección.")
    for indice, contenido in enumerate(pdfs if pdfs is not None else [pdf_valido()]):
        mail.add_attachment(contenido, maintype="application", subtype="pdf", filename=f"SDI-{indice}.pdf")
    return mail.as_bytes()


def pdf_formulario():
    hoy = timezone.localdate()
    mes = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")[hoy.month - 1]
    fila = "AT-01".ljust(33) + "Pieza A".ljust(47) + "10".ljust(23) + "10".ljust(23) + "5".ljust(22) + "0".ljust(22)
    lineas = ["FR-OPE-133", "SDI-123-001", f"{hoy.day}-{mes}-{hoy.year}", "P R O Y E C T O", "Proyecto prueba", "Código de Plano  Artículo", fila]
    writer = PdfWriter()
    pagina = writer.add_blank_page(width=1400, height=700)
    fuente = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Courier"), NameObject("/Encoding"): NameObject("/WinAnsiEncoding")})
    pagina[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(fuente)})})
    stream = DecodedStreamObject()
    stream.set_data(("BT /F1 10 Tf 20 650 Td\n" + "\n".join(f"({linea}) Tj 0 -18 Td" for linea in lineas) + "\nET").encode("cp1252"))
    pagina[NameObject("/Contents")] = writer._add_object(stream)
    salida = BytesIO()
    writer.write(salida)
    return salida.getvalue()


@override_settings(
    SDI_CORREO_USUARIO="gestor.correo",
    SDI_CORREO_REMITENTES={"bodega@example.invalid": "Bodega"},
    SDI_CORREO_DESTINATARIOS={"Calidad": "jefe@example.invalid", "Bodega": "departamento@example.invalid"},
    SDI_IMAP_HOST="imap.example.invalid", SDI_IMAP_USUARIO="calidad@example.invalid",
    SDI_IMAP_PASSWORD="clave-ficticia", SDI_IMAP_OAUTH_TOKEN="",
    DEFAULT_FROM_EMAIL="calidad@example.invalid",
)
class FlujoCorreoTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("gestor.correo")
        PerfilUsuario.objects.create(usuario=self.user, rol=PerfilUsuario.Rol.SUPERVISOR)
        self.propuesta = {
            "datos_generales": {
                "prefijo_bod": False, "activacion_proyecto": "123", "numero_sdi": "001",
                "fecha_emision": timezone.localdate().isoformat(), "proyecto": "Proyecto de prueba",
            },
            "articulos": [{"orden": 1, "articulo": "Pieza A", "codigo_plano": "AT-01", "cantidad_a_inspeccionar": 5, "observaciones": ""}],
        }
        self.parser = patch("quality.correo.procesar_pdf_sdi", return_value=self.propuesta).start()
        self.addCleanup(patch.stopall)

    def recibir(self):
        recibir_mensaje(mensaje())
        return SDI.objects.get()

    def aviso(self, evento=NotificacionSDI.Evento.INICIO, departamento="Bodega"):
        sdi = self.recibir()
        # El aviso de recepción se prueba por separado.
        NotificacionSDI.objects.all().delete()
        return registrar_notificacion_sdi(sdi, evento, departamento, "Estado SDI", "Resultado por artículo")

    def test_recibe_pendiente_con_productos_original_e_historial(self):
        original = pdf_valido()
        result = recibir_mensaje(mensaje([original]))
        sdi = SDI.objects.get()
        self.assertEqual(result, [(sdi.pk, True)])
        self.assertEqual(sdi.estado, SDI.Estado.PENDIENTE)
        self.assertIsNone(sdi.inspector)
        self.assertEqual(sdi.departamento_solicitante, "Bodega")
        self.assertEqual(ItemSDI.objects.get().cantidad_a_inspeccionar, 5)
        self.assertEqual(bytes(RecepcionCorreoSDI.objects.get().pdf_original), original)
        self.assertTrue(HistorialSDI.objects.filter(accion="SDI recibida por correo").exists())
        self.assertEqual(NotificacionSDI.objects.get().evento, NotificacionSDI.Evento.RECEPCION)

    def test_reenvio_del_mismo_pdf_no_duplica_sdi_ni_avisos(self):
        raw = mensaje()
        recibir_mensaje(raw)
        result = recibir_mensaje(raw.replace(b"<sdi-1@", b"<sdi-2@"))
        self.assertFalse(result[0][1])
        self.assertEqual(SDI.objects.count(), 1)
        self.assertEqual(NotificacionSDI.objects.count(), 1)
        self.assertEqual(self.parser.call_count, 1)

    def test_pdf_mime_con_parser_real_crea_sdi_y_producto(self):
        from .integraciones.sdi_pdf_parser import procesar_pdf_sdi
        self.parser.side_effect = procesar_pdf_sdi
        recibir_mensaje(mensaje([pdf_formulario()]))
        self.assertEqual(SDI.objects.get().proyecto, "Proyecto prueba")
        self.assertEqual(ItemSDI.objects.get().articulo, "Pieza A")
        self.assertEqual(ItemSDI.objects.get().cantidad_a_inspeccionar, 5)

    def test_pdf_invalido_revierte_todos_los_adjuntos(self):
        with self.assertRaises(ValidationError):
            recibir_mensaje(mensaje([pdf_valido(), b"contenido invalido"]))
        for model in (SDI, ItemSDI, RecepcionCorreoSDI, NotificacionSDI, HistorialSDI):
            self.assertEqual(model.objects.count(), 0)

    def test_otro_pdf_del_mismo_codigo_no_sobrescribe_datos(self):
        sdi = self.recibir()
        with self.assertRaises(IntegrityError):
            recibir_mensaje(mensaje([pdf_valido(paginas=2)]))
        self.assertEqual(RecepcionCorreoSDI.objects.count(), 1)
        self.assertEqual(SDI.objects.get().pk, sdi.pk)

    def test_rechaza_remitente_sin_autorizacion(self):
        with self.assertRaises(ValidationError):
            recibir_mensaje(mensaje(remitente="otro@example.invalid"))
        self.assertFalse(SDI.objects.exists())

    @override_settings(SDI_CORREO_REMITENTES={})
    def test_lista_vacia_no_autoriza_todos_los_remitentes(self):
        with self.assertRaises(ValidationError):
            recibir_mensaje(mensaje())

    def test_rechaza_multiples_remitentes(self):
        with self.assertRaises(ValidationError):
            recibir_mensaje(mensaje(remitente="bodega@example.invalid, otro@example.invalid"))

    def test_rechaza_mensaje_sin_pdf(self):
        with self.assertRaises(ValidationError):
            recibir_mensaje(mensaje(pdfs=[]))

    def test_rechaza_pdf_cifrado(self):
        with self.assertRaises(ValidationError):
            recibir_mensaje(mensaje([pdf_valido(cifrado=True)]))
        self.parser.assert_not_called()

    def test_rechaza_pdf_de_mas_de_cien_paginas(self):
        with self.assertRaises(ValidationError):
            recibir_mensaje(mensaje([pdf_valido(paginas=101)]))

    def test_rechaza_correo_superior_al_limite(self):
        with patch("quality.correo.MAX_CORREO", 10), self.assertRaises(ValidationError):
            recibir_mensaje(mensaje())

    def test_rechaza_pdf_superior_al_limite(self):
        with patch("quality.correo.MAX_PDF", 10), self.assertRaises(ValidationError):
            recibir_mensaje(mensaje())

    def test_no_importa_con_usuario_operativo_inactivo(self):
        self.user.is_active = False
        self.user.save()
        with self.assertRaises(PermissionDenied):
            recibir_mensaje(mensaje())
        self.assertFalse(RecepcionCorreoSDI.objects.exists())

    def test_error_de_extraccion_no_deja_registros_parciales(self):
        self.parser.side_effect = ValueError("PDF escaneado")
        with self.assertRaises(ValueError):
            recibir_mensaje(mensaje())
        self.assertFalse(SDI.objects.exists())

    @override_settings(MAILERS={"default": {"BACKEND": "django.core.mail.backends.console.EmailBackend"}})
    def test_consola_no_marca_avisos_como_entregados(self):
        aviso = self.aviso()
        self.assertEqual(enviar_avisos(), 0)
        aviso.refresh_from_db()
        self.assertEqual(aviso.intentos, 0)
        self.assertIsNone(aviso.fecha_envio)

    @override_settings(MAILERS=SMTP)
    @patch("django.core.mail.backends.smtp.EmailBackend.send_messages", return_value=1)
    def test_envio_confirmado_destina_al_origen_y_no_se_repite(self, send):
        aviso = self.aviso()
        self.assertEqual(enviar_avisos(), 1)
        self.assertEqual(enviar_avisos(), 0)
        send.assert_called_once()
        mail = send.call_args.args[0][0]
        self.assertEqual(mail.to, ["bodega@example.invalid"])
        aviso.refresh_from_db()
        self.assertEqual(aviso.estado_envio, NotificacionSDI.EstadoEnvio.ENVIADA)
        self.assertIsNotNone(aviso.fecha_envio)
        self.assertEqual(aviso.sdi.estado, SDI.Estado.PENDIENTE)

    @override_settings(MAILERS=SMTP)
    @patch("django.core.mail.backends.smtp.EmailBackend.send_messages", return_value=1)
    def test_revision_se_envia_a_calidad_y_no_al_solicitante(self, send):
        self.aviso(NotificacionSDI.Evento.REVISION, "Calidad")
        self.assertEqual(enviar_avisos(), 1)
        self.assertEqual(send.call_args.args[0][0].to, ["jefe@example.invalid"])

    @override_settings(MAILERS=SMTP)
    @patch("django.core.mail.backends.smtp.EmailBackend.send_messages", return_value=1)
    def test_sdi_manual_usa_destinatario_del_departamento(self, send):
        aviso = self.aviso()
        RecepcionCorreoSDI.objects.all().delete()
        self.assertEqual(enviar_avisos(), 1)
        self.assertEqual(send.call_args.args[0][0].to, ["departamento@example.invalid"])

    @override_settings(MAILERS=SMTP)
    @patch("django.core.mail.backends.smtp.EmailBackend.send_messages", side_effect=[0, 1])
    def test_reintento_con_espera_y_message_id_estable(self, send):
        aviso = self.aviso()
        self.assertEqual(enviar_avisos(), 0)
        aviso.refresh_from_db()
        self.assertEqual(aviso.estado_envio, NotificacionSDI.EstadoEnvio.ERROR)
        self.assertIsNone(aviso.fecha_envio)
        self.assertGreater(aviso.proximo_intento, timezone.now())
        self.assertEqual(enviar_avisos(), 0)
        aviso.proximo_intento = timezone.now() - timedelta(seconds=1)
        aviso.save()
        self.assertEqual(enviar_avisos(), 1)
        ids = [call.args[0][0].extra_headers["Message-ID"] for call in send.call_args_list]
        self.assertEqual(ids[0], ids[1])

    @override_settings(MAILERS=SMTP, SDI_CORREO_DESTINATARIOS={})
    @patch("django.core.mail.backends.smtp.EmailBackend.send_messages")
    def test_falta_destinatario_conserva_error_sin_enviar(self, send):
        aviso = self.aviso(NotificacionSDI.Evento.REVISION, "Calidad")
        self.assertEqual(enviar_avisos(), 0)
        send.assert_not_called()
        aviso.refresh_from_db()
        self.assertEqual(aviso.estado_envio, NotificacionSDI.EstadoEnvio.ERROR)

    @override_settings(MAILERS=SMTP)
    @patch("django.core.mail.backends.smtp.EmailBackend.send_messages", side_effect=RuntimeError("password=privada"))
    def test_error_no_registra_credenciales_del_servidor(self, send):
        aviso = self.aviso()
        enviar_avisos()
        aviso.refresh_from_db()
        self.assertNotIn("privada", aviso.ultimo_error)

    def buzon(self, raw):
        mailbox = MagicMock()
        mailbox.__enter__.return_value = mailbox
        mailbox.login.return_value = ("OK", [])
        mailbox.authenticate.return_value = ("OK", [])
        mailbox.select.return_value = ("OK", [])
        mailbox.uid.side_effect = lambda action, *args: {
            "search": ("OK", [b"17"]), "fetch": ("OK", [(b"", raw)]), "store": ("OK", []),
        }[action]
        return mailbox

    @patch("quality.correo.imaplib.IMAP4_SSL")
    def test_imap_lee_sin_marcar_hasta_guardar(self, imap):
        mailbox = self.buzon(mensaje())
        imap.return_value = mailbox
        self.assertEqual(consultar_buzon(), [])
        self.assertEqual(mailbox.uid.call_args_list[1].args, ("fetch", b"17", "(BODY.PEEK[])"))
        self.assertEqual(mailbox.uid.call_args_list[2].args, ("store", b"17", "+FLAGS", "(\\Seen)"))
        self.assertEqual(RecepcionCorreoSDI.objects.count(), 1)

    @patch("quality.correo.imaplib.IMAP4_SSL")
    def test_imap_no_marca_un_correo_fallido_como_leido(self, imap):
        mailbox = self.buzon(mensaje([b"no es PDF"]))
        imap.return_value = mailbox
        self.assertTrue(consultar_buzon())
        self.assertNotIn("store", [call.args[0] for call in mailbox.uid.call_args_list])

    @override_settings(SDI_IMAP_OAUTH_TOKEN="token-ficticio")
    @patch("quality.correo.imaplib.IMAP4_SSL")
    def test_imap_admite_token_oauth_sin_login_por_password(self, imap):
        mailbox = self.buzon(mensaje())
        imap.return_value = mailbox
        consultar_buzon()
        mailbox.login.assert_not_called()
        self.assertEqual(mailbox.authenticate.call_args.args[0], "XOAUTH2")

    @override_settings(SDI_IMAP_HOST="")
    def test_no_consulta_buzon_sin_configuracion(self):
        with self.assertRaises(ValidationError):
            consultar_buzon()

    @patch("quality.management.commands.process_sdi_mail.consultar_buzon")
    @patch("quality.management.commands.process_sdi_mail.enviar_avisos", return_value=0)
    def test_comando_solo_salida_no_consulta_imap(self, send, receive):
        call_command("process_sdi_mail", once=True, outbox_only=True, stdout=StringIO())
        receive.assert_not_called()
        send.assert_called_once()

    @patch("quality.management.commands.process_sdi_mail.consultar_buzon", return_value=["UID 17: ValidationError"])
    @patch("quality.management.commands.process_sdi_mail.enviar_avisos", return_value=0)
    def test_comando_informa_fallo_sin_impedir_salida(self, send, receive):
        with self.assertRaises(CommandError):
            call_command("process_sdi_mail", once=True, stdout=StringIO(), stderr=StringIO())
        send.assert_called_once()


class MigracionCorreoTests(TransactionTestCase):
    def test_conserva_avisos_y_sdis_anteriores(self):
        anterior = [("quality", "0009_revisionsdi_item")]
        actual = [("quality", "0010_flujo_correo_sdi")]
        executor = MigrationExecutor(connection)
        executor.migrate(anterior)
        try:
            apps = executor.loader.project_state(anterior).apps
            sdi = apps.get_model("quality", "SDI").objects.create(
                activacion_proyecto="12", numero_sdi="001", fecha_emision=timezone.localdate(),
                proyecto="Proyecto existente", departamento_solicitante="Bodega", solicitante="Usuario existente",
            )
            previo = apps.get_model("quality", "NotificacionSDI").objects.create(
                sdi=sdi, evento="cierre", departamento_destinatario="Bodega", asunto="Cierre", mensaje="Original",
                estado_envio="enviada", fecha_envio=timezone.now(), correo_destinatario="bodega@example.invalid",
            )
        finally:
            executor = MigrationExecutor(connection)
            executor.migrate(actual)
        conservado = NotificacionSDI.objects.get(pk=previo.pk)
        self.assertEqual(conservado.sdi_id, sdi.pk)
        self.assertEqual(conservado.mensaje, "Original")
        self.assertEqual(conservado.estado_envio, "enviada")
        self.assertIsNotNone(conservado.fecha_envio)
        self.assertEqual(conservado.intentos, 0)
