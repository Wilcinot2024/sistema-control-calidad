from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from email.message import EmailMessage
from rest_framework.test import APIClient
from unittest.mock import patch

from .models import ItemSDI, NotificacionSDI, PerfilUsuario, SDI
from .mail import receive_message, send_notifications
from .test_workflow import sample_pdf
from .workflow import notificar_asignacion_inspector, notificar_recepcion_jefes


class AvisoRecepcionJefesTests(TestCase):
    def setUp(self):
        self.sdi = SDI.objects.create(proyecto="Proyecto de prueba")

    def crear_destinatario(
        self, nombre, correo, rol=PerfilUsuario.Rol.JEFE_CALIDAD,
        usuario_activo=True, perfil_activo=True,
    ):
        usuario = get_user_model().objects.create_user(
            username=nombre, email=correo, is_active=usuario_activo,
        )
        PerfilUsuario.objects.create(usuario=usuario, rol=rol, activo=perfil_activo)
        return usuario

    def test_prepara_un_aviso_para_cada_jefe(self):
        self.crear_destinatario("jefe_uno", "uno@example.com")
        self.crear_destinatario("jefe_dos", "dos@example.com")
        self.assertEqual(notificar_recepcion_jefes(self.sdi), 2)
        self.assertSetEqual(
            set(self.sdi.notificaciones.values_list("destinatario", flat=True)),
            {"uno@example.com", "dos@example.com"},
        )
        for aviso in self.sdi.notificaciones.all():
            self.assertEqual(aviso.evento, "recepcion_jefe")
            self.assertIn(str(self.sdi.pk), aviso.mensaje)
            self.assertIn("pendiente de revisión y asignación", aviso.mensaje)
            self.assertIsNone(aviso.enviada)
            self.assertEqual(aviso.intentos, 0)

    def test_omite_otros_roles_inactivos_y_correos_invalidos(self):
        self.crear_destinatario("jefe_valido", "valido@example.com")
        self.crear_destinatario("cuenta_inactiva", "cuenta@example.com", usuario_activo=False)
        self.crear_destinatario("perfil_inactivo", "perfil@example.com", perfil_activo=False)
        self.crear_destinatario("sin_correo", "")
        self.crear_destinatario("solo_espacios", "   ")
        self.crear_destinatario("correo_invalido", "correo-invalido")
        for rol in (PerfilUsuario.Rol.ADMINISTRADOR, PerfilUsuario.Rol.SUPERVISOR, PerfilUsuario.Rol.INSPECTOR):
            self.crear_destinatario(rol, f"{rol}@example.com", rol=rol)
        self.assertEqual(notificar_recepcion_jefes(self.sdi), 1)
        self.assertEqual(self.sdi.notificaciones.get().destinatario, "valido@example.com")

    def test_dos_jefes_con_el_mismo_correo_comparten_un_aviso(self):
        self.crear_destinatario("jefe_uno", "compartido@example.com")
        self.crear_destinatario("jefe_dos", "  COMPARTIDO@example.com  ")
        self.assertEqual(notificar_recepcion_jefes(self.sdi), 1)
        self.assertEqual(self.sdi.notificaciones.get().destinatario, "compartido@example.com")

    def test_repetir_no_duplica_ni_reinicia_avisos_enviados(self):
        self.crear_destinatario("jefe", "jefe@example.com")
        self.assertEqual(notificar_recepcion_jefes(self.sdi), 1)
        aviso = self.sdi.notificaciones.get()
        enviada = timezone.now()
        aviso.enviada = enviada
        aviso.intentos = 2
        aviso.save(update_fields=["enviada", "intentos"])
        self.assertEqual(notificar_recepcion_jefes(self.sdi), 0)
        self.assertEqual(self.sdi.notificaciones.count(), 1)
        aviso.refresh_from_db()
        self.assertEqual(aviso.enviada, enviada)
        self.assertEqual(aviso.intentos, 2)

    def test_sin_jefes_devuelve_cero(self):
        self.assertEqual(notificar_recepcion_jefes(self.sdi), 0)
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_cada_sdi_tiene_su_propio_aviso(self):
        self.crear_destinatario("jefe", "jefe@example.com")
        otra_sdi = SDI.objects.create(proyecto="Otro proyecto de prueba")
        self.assertEqual(notificar_recepcion_jefes(self.sdi), 1)
        self.assertEqual(notificar_recepcion_jefes(otra_sdi), 1)
        self.assertEqual(NotificacionSDI.objects.count(), 2)


@override_settings(
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    SDI_ALLOWED_SENDERS=[],
)
class IntegracionAvisosRecepcionTests(TestCase):
    def setUp(self):
        self.jefe = get_user_model().objects.create_user(
            username="jefe_avisos", email="jefe@example.com",
        )
        PerfilUsuario.objects.create(usuario=self.jefe, rol=PerfilUsuario.Rol.JEFE_CALIDAD)
        self.supervisor = get_user_model().objects.create_user(username="supervisor_avisos")
        PerfilUsuario.objects.create(usuario=self.supervisor, rol=PerfilUsuario.Rol.SUPERVISOR)
        self.client = APIClient()
        self.client.force_authenticate(self.supervisor)
        self.datos = {
            "activacion_proyecto": "52", "numero_sdi": "12",
            "fecha_emision": timezone.localdate().isoformat(), "proyecto": "Proyecto de avisos",
            "departamento_solicitante": "Producción", "solicitante": "Solicitante de prueba",
            "correo_origen": "origen@example.com",
        }

    def test_registro_manual_deja_aviso_en_cola(self):
        respuesta = self.client.post("/api/sdi/", self.datos, format="json")
        self.assertEqual(respuesta.status_code, 201)
        aviso = NotificacionSDI.objects.get()
        self.assertEqual(aviso.sdi_id, respuesta.data["id"])
        self.assertEqual(aviso.destinatario, self.jefe.email)
        self.assertEqual(aviso.evento, "recepcion_jefe")
        self.assertIsNone(aviso.enviada)
        self.assertEqual(aviso.intentos, 0)

    def test_recepcion_por_pdf_y_repeticion_sin_duplicar(self):
        contenido = sample_pdf()
        for codigo_esperado in (201, 200):
            with self.subTest(codigo=codigo_esperado):
                archivo = SimpleUploadedFile("prueba.pdf", contenido, content_type="application/pdf")
                respuesta = self.client.post(
                    "/api/sdi/recepcion/", {"archivo": archivo, "correo_origen": "origen@example.com"},
                    format="multipart",
                )
                self.assertEqual(respuesta.status_code, codigo_esperado)
                self.assertEqual(NotificacionSDI.objects.count(), 1)
        self.assertEqual(NotificacionSDI.objects.get().destinatario, self.jefe.email)

    def test_recepcion_por_correo_y_repeticion_sin_duplicar(self):
        mensaje = EmailMessage()
        mensaje["From"] = "produccion@example.com"
        mensaje["To"] = "recepcion@example.com"
        mensaje["Subject"] = "Solicitud de inspección de prueba"
        mensaje["Message-ID"] = "<sdi-prueba@example.com>"
        mensaje.set_content("Documento de prueba.")
        mensaje.add_attachment(sample_pdf(), maintype="application", subtype="pdf", filename="sdi.pdf")
        primera = receive_message(mensaje.as_bytes())
        segunda = receive_message(mensaje.as_bytes())
        self.assertTrue(primera[0][1])
        self.assertFalse(segunda[0][1])
        aviso = NotificacionSDI.objects.get()
        self.assertEqual(aviso.destinatario, self.jefe.email)
        self.assertEqual(aviso.sdi.origen, "correo")

    def test_registro_invalido_no_genera_aviso(self):
        datos = dict(self.datos, activacion_proyecto="incorrecto")
        respuesta = self.client.post("/api/sdi/", datos, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(SDI.objects.exists())
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_error_al_preparar_aviso_revierte_registro_manual(self):
        with patch("quality.workflow_api.notificar_recepcion_jefes", side_effect=IntegrityError):
            respuesta = self.client.post("/api/sdi/", self.datos, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(SDI.objects.exists())
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_procesador_envia_aviso_simulado_y_no_lo_repite(self):
        respuesta = self.client.post("/api/sdi/", self.datos, format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(send_notifications(), 1)
        self.assertEqual(send_notifications(), 0)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.jefe.email])
        self.assertIn("pendiente de revisión y asignación", mail.outbox[0].body)
        self.assertIsNotNone(NotificacionSDI.objects.get().enviada)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AvisoAsignacionInspectorTests(TestCase):
    def setUp(self):
        self.supervisor = get_user_model().objects.create_user(username="supervisor_asignacion")
        PerfilUsuario.objects.create(usuario=self.supervisor, rol=PerfilUsuario.Rol.SUPERVISOR)
        self.inspector = get_user_model().objects.create_user(
            username="inspector_asignado", email="asignado@example.com",
        )
        PerfilUsuario.objects.create(usuario=self.inspector, rol=PerfilUsuario.Rol.INSPECTOR)
        self.otro = get_user_model().objects.create_user(
            username="otro_inspector", email="otro@example.com",
        )
        PerfilUsuario.objects.create(usuario=self.otro, rol=PerfilUsuario.Rol.INSPECTOR)
        self.sdi = SDI.objects.create(
            activacion_proyecto="52", numero_sdi="25", fecha_emision=timezone.localdate(),
            proyecto="Proyecto de asignación", departamento_solicitante="Producción",
            solicitante="Solicitante de prueba", correo_origen="origen@example.com",
        )
        self.item = ItemSDI.objects.create(
            sdi=self.sdi, orden=1, articulo="Pieza de prueba", cantidad_a_inspeccionar=5,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.supervisor)
        self.url = f"/api/sdi/{self.sdi.pk}/asignar/"

    def asignar(self):
        return self.client.post(self.url, {
            "inspector": self.inspector.pk, "instrucciones": "Revisar el plano adjunto.",
        }, format="json")

    def test_asignacion_prepara_aviso_solo_para_inspector_asignado_y_conserva_el_de_origen(self):
        respuesta = self.asignar()
        self.assertEqual(respuesta.status_code, 200)
        aviso = self.sdi.notificaciones.get(evento="asignacion_inspector")
        self.assertEqual(aviso.destinatario, self.inspector.email)
        self.assertIn(self.sdi.codigo_sdi, aviso.mensaje)
        self.assertIn(self.sdi.proyecto, aviso.mensaje)
        self.assertIn("Revisar el plano adjunto.", aviso.mensaje)
        self.assertIsNone(aviso.enviada)
        self.assertEqual(aviso.intentos, 0)
        self.assertFalse(self.sdi.notificaciones.filter(destinatario=self.otro.email).exists())
        self.assertEqual(self.sdi.notificaciones.get(evento="asignacion").destinatario, "origen@example.com")

    def test_repetir_no_duplica_ni_reinicia_el_aviso_enviado(self):
        self.assertEqual(self.asignar().status_code, 200)
        self.sdi.refresh_from_db()
        aviso = self.sdi.notificaciones.get(evento="asignacion_inspector")
        aviso.enviada = timezone.now()
        aviso.intentos = 1
        aviso.save(update_fields=["enviada", "intentos"])
        repetido = notificar_asignacion_inspector(self.sdi)
        self.assertEqual(repetido.pk, aviso.pk)
        self.assertEqual(repetido.enviada, aviso.enviada)
        self.assertEqual(repetido.intentos, 1)
        self.assertEqual(self.asignar().status_code, 400)
        self.assertEqual(self.sdi.notificaciones.filter(evento="asignacion_inspector").count(), 1)

    def test_no_genera_aviso_antes_de_asignar(self):
        self.assertIsNone(notificar_asignacion_inspector(self.sdi))
        self.sdi.inspector = self.inspector
        self.assertIsNone(notificar_asignacion_inspector(self.sdi))
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_asignacion_invalida_no_genera_aviso(self):
        self.item.delete()
        self.assertEqual(self.asignar().status_code, 400)
        self.assertFalse(NotificacionSDI.objects.exists())
        self.sdi.refresh_from_db()
        self.assertIsNone(self.sdi.asignada)

    def test_inspector_no_puede_asignarse_una_sdi(self):
        self.client.force_authenticate(self.inspector)
        self.assertEqual(self.asignar().status_code, 403)
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_inspector_inactivo_no_se_asigna_ni_recibe_aviso(self):
        self.inspector.is_active = False
        self.inspector.save(update_fields=["is_active"])
        self.assertEqual(self.asignar().status_code, 400)
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_sin_correo_se_asigna_pero_no_se_encola_un_destinatario_vacio(self):
        self.inspector.email = ""
        self.inspector.save(update_fields=["email"])
        self.assertEqual(self.asignar().status_code, 200)
        self.assertFalse(self.sdi.notificaciones.filter(evento="asignacion_inspector").exists())
        self.assertEqual(self.sdi.notificaciones.get().destinatario, "origen@example.com")

    def test_omite_correos_invalidos_y_normaliza_el_valido(self):
        self.sdi.inspector = self.inspector
        self.sdi.asignada = timezone.now()
        for correo in ("", "   ", "correo-invalido"):
            with self.subTest(correo=correo):
                self.inspector.email = correo
                self.assertIsNone(notificar_asignacion_inspector(self.sdi))
        self.inspector.email = "  ASIGNADO@example.com  "
        aviso = notificar_asignacion_inspector(self.sdi)
        self.assertEqual(aviso.destinatario, "asignado@example.com")

    def test_error_al_crear_aviso_revierte_asignacion_inspecciones_e_historial(self):
        with patch("quality.workflow.notificar_asignacion_inspector", side_effect=IntegrityError):
            respuesta = self.asignar()
        self.assertEqual(respuesta.status_code, 400)
        self.sdi.refresh_from_db()
        self.assertIsNone(self.sdi.inspector_id)
        self.assertIsNone(self.sdi.asignada)
        self.assertEqual(self.sdi.estado, SDI.Estado.PENDIENTE)
        self.assertFalse(self.item.inspecciones.exists())
        self.assertFalse(self.sdi.historial.exists())
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_envio_simulado_al_inspector_y_al_origen_sin_repetir(self):
        self.assertEqual(self.asignar().status_code, 200)
        self.assertEqual(send_notifications(), 2)
        self.assertEqual(send_notifications(), 0)
        self.assertEqual(len(mail.outbox), 2)
        self.assertSetEqual(
            {mensaje.to[0] for mensaje in mail.outbox},
            {self.inspector.email, "origen@example.com"},
        )
        self.assertFalse(self.sdi.notificaciones.filter(enviada__isnull=True).exists())

    def test_error_de_envio_deja_aviso_pendiente_y_permite_reintento(self):
        self.assertEqual(self.asignar().status_code, 200)
        with patch("quality.mail.EmailMessage.send", side_effect=ConnectionError):
            self.assertEqual(send_notifications(), 0)
        aviso = self.sdi.notificaciones.get(evento="asignacion_inspector")
        self.assertIsNone(aviso.enviada)
        self.assertEqual(aviso.intentos, 1)
        self.assertTrue(aviso.error)
        self.assertGreater(aviso.proximo_intento, timezone.now())
        self.sdi.notificaciones.update(proximo_intento=timezone.now())
        self.assertEqual(send_notifications(), 2)
        aviso.refresh_from_db()
        self.assertIsNotNone(aviso.enviada)
        self.assertEqual(aviso.intentos, 2)
        self.assertEqual(aviso.error, "")
