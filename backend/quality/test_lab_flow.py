"""Pruebas funcionales del primer recorrido y sus límites de autorización."""

from io import BytesIO
import json

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from pypdf import PdfWriter
from rest_framework.test import APIClient

from .models import AvisoSDI, DepartamentoSDI, DocumentoSDI, NotificacionSDI, PerfilUsuario, SDI


class LaboratorioSDITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        departamento = DepartamentoSDI.objects.create(nombre="Producción", correo="produccion@example.test")
        bodega = DepartamentoSDI.objects.create(nombre="Bodega", correo="bodega@example.test")
        cls.users = {}
        for name, role in [("prod", "solicitante"), ("prod2", "solicitante"), ("bod", "solicitante"),
                           ("inspector", "inspector"), ("otro", "inspector"), ("supervisor", "supervisor"),
                           ("jefe", "jefe_calidad"), ("admin", "administrador")]:
            user = get_user_model().objects.create_user(username="lab." + name, email=name + "@example.test", password="solo-pruebas-2026")
            PerfilUsuario.objects.create(usuario=user, rol=role, departamento=(bodega if name == "bod" else departamento) if role == "solicitante" else None)
            cls.users[name] = user

    def setUp(self):
        self.client = APIClient()

    def como(self, name):
        self.client.force_authenticate(self.users[name])

    def alta(self, variante="A", numero="001", cuenta="prod"):
        self.como(cuenta)
        body = {"flujo": variante, "activacion_proyecto": "0001", "numero_sdi": numero,
                "fecha_emision": str(timezone.localdate()), "proyecto": "Prueba de flujo", "prioridad": "media",
                "productos": [{"articulo": "Pieza uno", "cantidad_indicada": 4}, {"articulo": "Pieza dos", "cantidad_indicada": 2}]}
        response = self.client.post("/api/lab/sdi/", body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def post(self, sdi, accion, data=None, status=200):
        response = self.client.post(f"/api/lab/sdi/{sdi['id']}/{accion}/", data or {}, format="json")
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def asignar(self, sdi):
        self.como("supervisor")
        return self.post(sdi, "asignar", {"inspector": self.users["inspector"].pk,
                         "alcances": [{"producto": p["id"], "cantidad": p["cantidad_indicada"]} for p in sdi["productos"]]})

    def iniciar(self, sdi):
        self.asignar(sdi)
        self.como("inspector")
        return self.post(sdi, "iniciar")

    def evaluar_todos(self, sdi, ultimo="aprobada"):
        self.como("inspector")
        for index, p in enumerate(sdi["productos"]):
            resultado = ultimo if index == len(sdi["productos"]) - 1 else "aprobada"
            sdi = self.post(sdi, f"productos/{p['id']}/evaluar", {
                "resultado": resultado, "observaciones": "Medición y verificación registradas.",
                "visual": {c: "conforme" for c in ["rebarbas", "rayaduras", "golpes", "deformidad", "pintura", "burbujas", "planitud"]},
            })
        return sdi

    def test_recorrido_a_aprobado_y_correos(self):
        sdi = self.alta()
        asignada = self.asignar(sdi)
        self.assertEqual(asignada["estado"], "pendiente")
        self.assertFalse(NotificacionSDI.objects.filter(evento="inicio").exists())
        self.como("inspector")
        self.post(sdi, "iniciar")
        self.evaluar_todos(sdi)
        revision = self.post(sdi, "revision")
        self.assertFalse(revision["capacidades"]["evaluar"])
        self.como("supervisor")
        cerrada = self.post(sdi, "cerrar", {"comentario": "Resultados y evidencias revisados."})
        self.assertEqual(cerrada["resultado_cierre"], "aprobada")
        self.assertEqual(len(cerrada["cierre_detalle"]["productos"]), 2)
        response = self.client.post("/api/lab/capturar/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["capturados"], NotificacionSDI.objects.count())
        self.assertFalse(NotificacionSDI.objects.filter(enviada__isnull=False).exists())

    def test_recorrido_b_mixto_rechazado(self):
        sdi = self.alta("B")
        self.assertEqual(self.asignar(sdi)["estado"], "asignada")
        self.como("inspector")
        self.post(sdi, "iniciar")
        self.evaluar_todos(sdi, "rechazada")
        self.post(sdi, "revision")
        self.como("jefe")
        cerrada = self.post(sdi, "cerrar", {"comentario": "Se valida el desglose."})
        self.assertEqual(cerrada["resultado_cierre"], "rechazada")
        self.assertEqual(cerrada["productos"][0]["resultado_actual"], "aprobada")
        self.assertIn('"resultado": "rechazada"', NotificacionSDI.objects.get(evento="cierre").mensaje)

    def test_solicitantes_del_mismo_departamento_no_comparten_acceso(self):
        sdi = self.alta()
        self.como("prod2")
        self.assertEqual(self.client.get("/api/lab/sdi/").data, [])
        self.assertEqual(self.client.get(f"/api/lab/sdi/{sdi['id']}/").status_code, 404)
        self.assertEqual(self.client.get("/api/lab/avisos/").data, [])

    def test_otro_inspector_no_puede_iniciar(self):
        sdi = self.alta()
        self.asignar(sdi)
        self.como("otro")
        self.post(sdi, "iniciar", status=404)
        self.assertFalse(NotificacionSDI.objects.filter(evento="inicio").exists())

    def test_asignador_inactivo_no_impide_inicio_del_inspector(self):
        sdi = self.alta()
        self.asignar(sdi)
        self.users["supervisor"].is_active = False
        self.users["supervisor"].save()
        self.como("inspector")
        self.assertEqual(self.post(sdi, "iniciar")["estado"], "en_proceso")

    def test_gestor_no_puede_registrar_evaluacion_inicial(self):
        sdi = self.iniciar(self.alta())
        self.como("admin")
        p = sdi["productos"][0]
        self.post(sdi, f"productos/{p['id']}/evaluar", {"resultado": "aprobada", "observaciones": "Intento no autorizado", "visual": {c: "conforme" for c in ["rebarbas", "rayaduras", "golpes", "deformidad", "pintura", "burbujas", "planitud"]}}, status=403)

    def test_trabajo_incompleto_no_se_envia(self):
        sdi = self.iniciar(self.alta())
        self.post(sdi, "revision", status=400)
        self.assertFalse(NotificacionSDI.objects.filter(evento="revision").exists())

    def test_inspector_no_cierra(self):
        sdi = self.iniciar(self.alta())
        self.evaluar_todos(sdi)
        self.post(sdi, "revision")
        self.post(sdi, "cerrar", {"comentario": "No autorizado"}, status=403)

    def test_lectura_en_revision_y_bloqueo_de_escritura(self):
        sdi = self.iniciar(self.alta())
        self.evaluar_todos(sdi)
        self.post(sdi, "revision")
        self.assertEqual(self.client.get(f"/api/lab/sdi/{sdi['id']}/").status_code, 200)
        p = sdi["productos"][0]
        self.post(sdi, f"productos/{p['id']}/evaluar", {"resultado": "rechazada", "observaciones": "No autorizado", "visual": {c: "conforme" for c in ["rebarbas", "rayaduras", "golpes", "deformidad", "pintura", "burbujas", "planitud"]}}, status=400)

    def test_repetir_acciones_no_duplica_eventos_ni_unidades(self):
        sdi = self.alta()
        self.asignar(sdi)
        self.asignar(sdi)
        self.como("inspector")
        self.post(sdi, "iniciar")
        self.post(sdi, "iniciar")
        self.evaluar_todos(sdi)
        self.evaluar_todos(sdi)
        self.post(sdi, "revision")
        self.post(sdi, "revision")
        self.como("supervisor")
        self.post(sdi, "cerrar", {"comentario": "Validado"})
        self.post(sdi, "cerrar", {"comentario": "Validado"})
        self.assertEqual(NotificacionSDI.objects.filter(evento="inicio").count(), 1)
        self.assertEqual(NotificacionSDI.objects.filter(evento="cierre").count(), 1)
        self.assertEqual(NotificacionSDI.objects.filter(evento="revision").count(), 3)
        self.assertEqual(SDI.objects.get(pk=sdi["id"]).items.first().unidades_liberadas, 4)

    def test_duplicado_bloqueado_sin_revelar_propietario(self):
        self.alta()
        self.como("prod2")
        body = {"flujo": "A", "activacion_proyecto": "0001", "numero_sdi": "001", "fecha_emision": str(timezone.localdate()), "proyecto": "Duplicado", "productos": [{"articulo": "Pieza", "cantidad_indicada": 1}]}
        response = self.client.post("/api/lab/sdi/", body, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SDI.objects.count(), 1)
        self.assertNotIn("lab.prod", str(response.data))

    def test_departamento_procede_del_perfil(self):
        sdi = self.alta(cuenta="bod")
        self.assertEqual(sdi["departamento_solicitante"], "Bodega")
        self.assertEqual(sdi["correo_origen"], "bodega@example.test")

    def test_informacion_a_b_y_bloqueo_asignacion(self):
        for variante, estado in [("A", "pendiente"), ("B", "requiere_info")]:
            with self.subTest(variante=variante):
                sdi = self.alta(variante, "00" + variante.replace("A", "2").replace("B", "3"))
                self.como("supervisor")
                requerida = self.post(sdi, "informacion", {"motivo": "Falta especificación técnica"})
                self.assertEqual(requerida["estado"], estado)
                self.post(sdi, "asignar", {"inspector": self.users["inspector"].pk, "alcances": [{"producto": p["id"], "cantidad": 1} for p in sdi["productos"]]}, status=400)
                self.como("prod")
                completada = self.post(sdi, "completar", {"respuesta": "Se precisa tolerancia en las observaciones."})
                self.assertEqual(completada["estado"], "pendiente")
                self.assertEqual(AvisoSDI.objects.filter(sdi_id=sdi["id"], usuario=self.users["prod"], evento="informacion").count(), 1)
                self.asignar(sdi)

    def test_destinatario_ausente_conserva_accion_y_error_visible(self):
        sdi = self.alta()
        self.users["inspector"].email = ""
        self.users["inspector"].save()
        self.asignar(sdi)
        self.client.post("/api/lab/capturar/")
        aviso = NotificacionSDI.objects.get(evento="asignacion")
        self.assertTrue(aviso.error)
        self.assertIsNone(aviso.capturada)
        self.assertIsNotNone(SDI.objects.get(pk=sdi["id"]).asignada)

    def test_solicitante_no_ve_diagnostico_global(self):
        sdi = self.alta()
        self.assertNotIn("correos", sdi)
        self.assertEqual(self.client.post("/api/lab/capturar/").status_code, 403)

    def test_alcance_ajeno_o_excesivo_no_se_guarda(self):
        sdi = self.alta()
        self.como("supervisor")
        self.post(sdi, "asignar", {"inspector": self.users["inspector"].pk, "alcances": [{"producto": p["id"], "cantidad": 99} for p in sdi["productos"]]}, status=400)
        self.assertIsNone(SDI.objects.get(pk=sdi["id"]).asignada)

    def test_criterios_visual_no_se_inventan(self):
        sdi = self.iniciar(self.alta())
        self.post(sdi, f"productos/{sdi['productos'][0]['id']}/evaluar", {"resultado": "aprobada", "observaciones": "Faltan criterios", "visual": {}}, status=400)

    def test_preview_incompleta_no_crea_sdi(self):
        self.como("prod")
        writer = PdfWriter()
        writer.add_blank_page(width=400, height=500)
        buffer = BytesIO()
        writer.write(buffer)
        response = self.client.post("/api/lab/preview/", {"archivo": SimpleUploadedFile("escaneado.pdf", buffer.getvalue(), content_type="application/pdf")})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["advertencias"])
        self.assertFalse(SDI.objects.exists())
        self.assertFalse(NotificacionSDI.objects.exists())

    def test_pdf_invalido_no_crea_registros(self):
        self.como("prod")
        response = self.client.post("/api/lab/preview/", {"archivo": SimpleUploadedFile("falso.pdf", b"no pdf")})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(SDI.objects.exists())

    def test_confirmar_pdf_incompleto_y_descarga_segun_propiedad(self):
        self.como("prod")
        writer = PdfWriter()
        writer.add_blank_page(width=400, height=500)
        buffer = BytesIO()
        writer.write(buffer)
        datos = {"flujo": "A", "activacion_proyecto": "0002", "numero_sdi": "0001", "fecha_emision": str(timezone.localdate()),
                 "proyecto": "Completado manualmente", "productos": [{"articulo": "Pieza", "cantidad_indicada": 2}]}
        with override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}):
            response = self.client.post("/api/lab/sdi/", {"datos": json.dumps(datos), "archivo": SimpleUploadedFile("original.pdf", buffer.getvalue(), content_type="application/pdf")})
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["codigo_sdi"], "SDI-0002-0001")
            doc = response.data["documentos"][0]
            descarga = self.client.get(doc["url"])
            self.assertEqual(descarga.status_code, 200)
            self.assertEqual(b"".join(descarga.streaming_content), buffer.getvalue())
            self.como("prod2")
            self.assertEqual(self.client.get(doc["url"]).status_code, 404)

    def test_jwt_real_y_sesion_de_usuario(self):
        self.client.force_authenticate(None)
        token = self.client.post("/api/token/", {"username": "lab.prod", "password": "solo-pruebas-2026"}, format="json")
        self.assertEqual(token.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + token.data["access"])
        self.assertEqual(self.client.get("/api/me/").data["username"], "lab.prod")

    def test_api_funciona_sin_publicar_el_frontend(self):
        self.como("prod")
        self.assertEqual(self.client.get("/api/me/").status_code, 200)
        self.assertEqual(self.client.get("/").status_code, 404)
        self.assertEqual(self.client.get("/lab/app.js").status_code, 404)
        self.assertEqual(self.client.get("/lab/secret.txt").status_code, 404)

    @override_settings(LAB_ENABLED=False)
    def test_laboratorio_deshabilitado(self):
        self.como("prod")
        self.assertEqual(self.client.get("/api/lab/sdi/").status_code, 404)
