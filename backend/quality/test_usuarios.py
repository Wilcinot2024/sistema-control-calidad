from django.contrib.auth import get_user_model
from django.contrib.admin.models import ADDITION, CHANGE, LogEntry
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Area, PerfilUsuario


class EdicionUsuariosAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuarios = {}
        for rol in PerfilUsuario.Rol.values:
            usuario = get_user_model().objects.create_user(
                username=f"prueba_{rol}", password="Solo-pruebas-locales-2026!",
            )
            PerfilUsuario.objects.create(usuario=usuario, rol=rol)
            cls.usuarios[rol] = usuario
        cls.area = Area.objects.create(nombre="Área de prueba")
        cls.area_inactiva = Area.objects.create(nombre="Área inactiva", activo=False)

    def setUp(self):
        self.client = APIClient()
        self.admin = self.usuarios[PerfilUsuario.Rol.ADMINISTRADOR]
        self.inspector = self.usuarios[PerfilUsuario.Rol.INSPECTOR]

    def url(self, usuario):
        return reverse("detalle_usuario_api", args=[usuario.pk])

    def autenticar(self, usuario):
        token = RefreshToken.for_user(usuario).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def editar(self, usuario, datos):
        return self.client.patch(self.url(usuario), datos, format="json")

    def test_exige_autenticacion_y_rechaza_token_invalido(self):
        self.assertEqual(self.client.get(self.url(self.inspector)).status_code, 401)
        self.assertEqual(self.editar(self.inspector, {"first_name": "Prueba"}).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer token-invalido")
        self.assertEqual(self.client.get(self.url(self.inspector)).status_code, 401)

    def test_consulta_solo_expone_campos_publicos(self):
        self.autenticar(self.admin)
        respuesta = self.client.get(self.url(self.inspector))
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(set(respuesta.data), {
            "id", "username", "first_name", "last_name", "email", "rol", "area_id", "activo",
        })
        self.assertTrue(respuesta.data["activo"])

    def test_edicion_parcial_persiste_sin_alterar_credenciales(self):
        self.autenticar(self.admin)
        password_anterior = self.inspector.password
        respuesta = self.editar(self.inspector, {
            "first_name": "  Nombre  ", "last_name": "Prueba", "email": "prueba@example.com",
        })
        self.assertEqual(respuesta.status_code, 200)
        self.inspector.refresh_from_db()
        self.assertEqual(self.inspector.first_name, "Nombre")
        self.assertEqual(self.inspector.last_name, "Prueba")
        self.assertEqual(self.inspector.email, "prueba@example.com")
        self.assertEqual(self.inspector.password, password_anterior)
        self.assertEqual(self.inspector.username, "prueba_inspector")
        self.assertFalse(self.inspector.is_staff)
        self.assertFalse(self.inspector.is_superuser)

    def test_matriz_de_roles_en_consulta_y_edicion(self):
        permitidos = {
            "administrador": set(PerfilUsuario.Rol.values),
            "jefe_calidad": {"supervisor", "inspector"},
            "supervisor": {"inspector"},
            "inspector": set(),
        }
        for rol_actor, actor in self.usuarios.items():
            self.autenticar(actor)
            for rol_objetivo, objetivo in self.usuarios.items():
                esperado = 200 if rol_objetivo in permitidos[rol_actor] else (
                    403 if rol_actor == "inspector" else 404
                )
                with self.subTest(actor=rol_actor, objetivo=rol_objetivo):
                    self.assertEqual(self.client.get(self.url(objetivo)).status_code, esperado)
                    self.assertEqual(self.editar(objetivo, {"last_name": "Prueba"}).status_code, esperado)

    def test_jefe_puede_promover_inspector_a_supervisor(self):
        self.autenticar(self.usuarios[PerfilUsuario.Rol.JEFE_CALIDAD])
        respuesta = self.editar(self.inspector, {"rol": "supervisor"})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["rol"], "supervisor")
        self.inspector.perfil.refresh_from_db()
        self.assertEqual(self.inspector.perfil.rol, "supervisor")

    def test_rechaza_elevacion_de_rol_y_no_guarda_otros_campos(self):
        for actor, rol in [("supervisor", "jefe_calidad"), ("jefe_calidad", "administrador")]:
            with self.subTest(actor=actor, rol=rol):
                self.autenticar(self.usuarios[actor])
                respuesta = self.editar(self.inspector, {"rol": rol, "first_name": "No guardar"})
                self.assertEqual(respuesta.status_code, 403)
                self.inspector.refresh_from_db()
                self.inspector.perfil.refresh_from_db()
                self.assertEqual(self.inspector.first_name, "")
                self.assertEqual(self.inspector.perfil.rol, "inspector")

    def test_rechaza_campos_desconocidos_y_cuerpo_vacio(self):
        self.autenticar(self.admin)
        for campo in ("is_superuser", "is_staff", "password", "username", "usuario_id"):
            with self.subTest(campo=campo):
                respuesta = self.editar(self.inspector, {campo: True, "first_name": "No guardar"})
                self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(self.editar(self.inspector, {}).status_code, 400)
        self.assertEqual(self.editar(self.inspector, []).status_code, 400)
        self.inspector.refresh_from_db()
        self.assertEqual(self.inspector.first_name, "")

    def test_rechaza_correo_rol_y_nombre_invalidos(self):
        self.autenticar(self.admin)
        for datos in ({"email": "incorrecto"}, {"rol": "inventado"}, {"first_name": "x" * 151}):
            with self.subTest(datos=datos):
                self.assertEqual(self.editar(self.inspector, datos).status_code, 400)

    def test_asigna_y_quita_area(self):
        self.autenticar(self.admin)
        respuesta = self.editar(self.inspector, {"area_id": self.area.pk})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["area_id"], self.area.pk)
        self.assertEqual(self.editar(self.inspector, {"area_id": None}).status_code, 200)
        self.inspector.perfil.refresh_from_db()
        self.assertIsNone(self.inspector.perfil.area_id)

    def test_area_invalida_no_deja_cambios_parciales(self):
        self.autenticar(self.admin)
        for area_id in (self.area_inactiva.pk, 999999, 0):
            with self.subTest(area_id=area_id):
                respuesta = self.editar(self.inspector, {"area_id": area_id, "first_name": "No guardar"})
                self.assertEqual(respuesta.status_code, 400)
        self.inspector.refresh_from_db()
        self.assertEqual(self.inspector.first_name, "")

    def test_sincroniza_activacion_y_revoca_acceso_del_usuario_desactivado(self):
        token_inspector = RefreshToken.for_user(self.inspector).access_token
        self.autenticar(self.admin)
        respuesta = self.editar(self.inspector, {"activo": False})
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data["activo"])
        self.inspector.refresh_from_db()
        self.inspector.perfil.refresh_from_db()
        self.assertFalse(self.inspector.is_active)
        self.assertFalse(self.inspector.perfil.activo)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_inspector}")
        self.assertEqual(self.client.get(self.url(self.inspector)).status_code, 401)
        self.autenticar(self.admin)
        self.assertEqual(self.editar(self.inspector, {"activo": True}).status_code, 200)
        self.inspector.refresh_from_db()
        self.inspector.perfil.refresh_from_db()
        self.assertTrue(self.inspector.is_active)
        self.assertTrue(self.inspector.perfil.activo)

    def test_no_permite_desactivarse_ni_cambiar_el_propio_rol(self):
        self.autenticar(self.admin)
        for datos in ({"activo": False}, {"rol": "inspector"}):
            with self.subTest(datos=datos):
                self.assertEqual(self.editar(self.admin, datos).status_code, 400)

    def test_protege_cuentas_del_administrador_de_django(self):
        self.autenticar(self.admin)
        for atributo in ("is_staff", "is_superuser"):
            with self.subTest(atributo=atributo):
                setattr(self.inspector, atributo, True)
                self.inspector.save(update_fields=[atributo])
                self.assertEqual(self.client.get(self.url(self.inspector)).status_code, 404)
                self.assertEqual(self.editar(self.inspector, {"first_name": "No guardar"}).status_code, 404)
                setattr(self.inspector, atributo, False)
                self.inspector.save(update_fields=[atributo])

    def test_perfil_inactivo_o_inexistente_no_puede_gestionar(self):
        self.admin.perfil.activo = False
        self.admin.perfil.save(update_fields=["activo"])
        self.autenticar(self.admin)
        self.assertEqual(self.editar(self.inspector, {"first_name": "No guardar"}).status_code, 403)
        self.admin.perfil.delete()
        self.assertEqual(self.client.get(self.url(self.inspector)).status_code, 403)

    def test_usuario_inexistente_devuelve_404(self):
        self.autenticar(self.admin)
        url = reverse("detalle_usuario_api", args=[999999])
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_edicion_registra_actor_y_campos_sin_valores_privados(self):
        self.autenticar(self.admin)
        respuesta = self.editar(self.inspector, {"email": "privado@example.com"})
        self.assertEqual(respuesta.status_code, 200)
        evento = LogEntry.objects.get(action_flag=CHANGE)
        self.assertEqual(evento.user_id, self.admin.pk)
        self.assertEqual(evento.object_id, str(self.inspector.pk))
        self.assertIn("email", evento.change_message)
        self.assertNotIn("privado@example.com", evento.change_message)


class CreacionUsuariosAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuarios = {}
        for rol in PerfilUsuario.Rol.values:
            usuario = get_user_model().objects.create_user(username=f"gestor_{rol}")
            PerfilUsuario.objects.create(usuario=usuario, rol=rol)
            cls.usuarios[rol] = usuario
        cls.area = Area.objects.create(nombre="Área para altas")
        cls.area_inactiva = Area.objects.create(nombre="Área desactivada", activo=False)

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("crear_usuario_api")
        self.admin = self.usuarios[PerfilUsuario.Rol.ADMINISTRADOR]
        self.autenticar(self.admin)

    def autenticar(self, usuario):
        token = RefreshToken.for_user(usuario).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def crear(self, **cambios):
        datos = {
            "username": "cuenta_nueva", "password": "Roca-Delta_8!Luna_42", "rol": "inspector",
        }
        datos.update(cambios)
        return self.client.post(self.url, datos, format="json")

    def test_exige_autenticacion_y_rechaza_token_invalido(self):
        self.client.credentials()
        self.assertEqual(self.crear().status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer token-invalido")
        self.assertEqual(self.crear().status_code, 401)

    def test_matriz_de_roles_al_crear(self):
        permitidos = {
            "administrador": set(PerfilUsuario.Rol.values),
            "jefe_calidad": {"supervisor", "inspector"},
            "supervisor": {"inspector"},
            "inspector": set(),
        }
        for rol_actor, actor in self.usuarios.items():
            self.autenticar(actor)
            for rol_nuevo in PerfilUsuario.Rol.values:
                with self.subTest(actor=rol_actor, rol_nuevo=rol_nuevo):
                    cantidad_anterior = get_user_model().objects.count()
                    perfiles_anteriores = PerfilUsuario.objects.count()
                    eventos_anteriores = LogEntry.objects.count()
                    esperado = 201 if rol_nuevo in permitidos[rol_actor] else 403
                    respuesta = self.crear(username=f"alta_{rol_actor}_{rol_nuevo}", rol=rol_nuevo)
                    self.assertEqual(respuesta.status_code, esperado)
                    incremento = int(esperado == 201)
                    self.assertEqual(get_user_model().objects.count(), cantidad_anterior + incremento)
                    self.assertEqual(PerfilUsuario.objects.count(), perfiles_anteriores + incremento)
                    self.assertEqual(LogEntry.objects.count(), eventos_anteriores + incremento)

    def test_guarda_hash_y_no_devuelve_contrasena_ni_permisos_de_django(self):
        respuesta = self.crear(rol="administrador", first_name="  Nombre  ", email="alta@example.com")
        self.assertEqual(respuesta.status_code, 201)
        usuario = get_user_model().objects.get(pk=respuesta.data["id"])
        self.assertTrue(usuario.check_password("Roca-Delta_8!Luna_42"))
        self.assertNotEqual(usuario.password, "Roca-Delta_8!Luna_42")
        self.assertFalse(usuario.is_staff)
        self.assertFalse(usuario.is_superuser)
        self.assertEqual(usuario.first_name, "Nombre")
        self.assertEqual(usuario.perfil.rol, "administrador")
        self.assertNotIn("password", respuesta.data)
        self.assertNotIn("Roca-Delta_8!Luna_42", str(respuesta.data))

    def test_conserva_espacios_en_la_contrasena(self):
        password = "  Roca-Delta_8!Luna_42  "
        respuesta = self.crear(password=password)
        self.assertEqual(respuesta.status_code, 201)
        usuario = get_user_model().objects.get(pk=respuesta.data["id"])
        self.assertTrue(usuario.check_password(password))
        self.assertFalse(usuario.check_password(password.strip()))

    def test_valida_contrasena_y_similitud_con_el_usuario(self):
        cantidad_anterior = get_user_model().objects.count()
        for password in ("a", "12345678", "nombre_peculiar_de_prueba"):
            with self.subTest(password=password):
                respuesta = self.crear(username="nombre_peculiar_de_prueba", password=password)
                self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(get_user_model().objects.count(), cantidad_anterior)
        self.assertEqual(LogEntry.objects.count(), 0)

    def test_rechaza_nombre_duplicado_sin_distinguir_mayusculas(self):
        respuesta = self.crear(username=self.admin.username.upper())
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("username", respuesta.data)
        self.assertEqual(LogEntry.objects.count(), 0)

    def test_rechaza_nombres_vacios_invalidos_o_demasiado_largos(self):
        for username in ("", "   ", "nombre con espacios", "x" * 151):
            with self.subTest(username=username):
                self.assertEqual(self.crear(username=username).status_code, 400)

    def test_campos_obligatorios(self):
        datos = {"username": "cuenta_nueva", "password": "Roca-Delta_8!Luna_42", "rol": "inspector"}
        for campo in datos:
            with self.subTest(campo=campo):
                respuesta = self.client.post(
                    self.url, {clave: valor for clave, valor in datos.items() if clave != campo}, format="json",
                )
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn(campo, respuesta.data)

    def test_rechaza_campos_protegidos_y_desconocidos(self):
        cantidad_anterior = get_user_model().objects.count()
        for campo in ("is_staff", "is_superuser", "is_active", "groups", "user_permissions", "id", "extra"):
            with self.subTest(campo=campo):
                self.assertEqual(self.crear(**{campo: True}).status_code, 400)
        self.assertEqual(get_user_model().objects.count(), cantidad_anterior)

    def test_rechaza_correo_y_rol_invalidos(self):
        self.assertEqual(self.crear(email="sin-formato").status_code, 400)
        self.assertEqual(self.crear(rol="inventado").status_code, 400)

    def test_area_opcional_o_activa(self):
        for indice, cambios in enumerate(({}, {"area_id": None}, {"area_id": self.area.pk})):
            with self.subTest(cambios=cambios):
                respuesta = self.crear(username=f"usuario_area_{indice}", **cambios)
                self.assertEqual(respuesta.status_code, 201)
                self.assertEqual(respuesta.data["area_id"], cambios.get("area_id"))

    def test_area_invalida_no_crea_cuentas(self):
        cantidad_anterior = get_user_model().objects.count()
        for area_id in (self.area_inactiva.pk, 999999, 0):
            with self.subTest(area_id=area_id):
                self.assertEqual(self.crear(area_id=area_id).status_code, 400)
        self.assertEqual(get_user_model().objects.count(), cantidad_anterior)

    def test_estado_activo_sincronizado(self):
        for activo in (True, False):
            with self.subTest(activo=activo):
                respuesta = self.crear(username=f"estado_{activo}", activo=activo)
                self.assertEqual(respuesta.status_code, 201)
                usuario = get_user_model().objects.get(pk=respuesta.data["id"])
                self.assertEqual(usuario.is_active, activo)
                self.assertEqual(usuario.perfil.activo, activo)
                self.assertEqual(respuesta.data["activo"], activo)

    def test_perfil_inactivo_o_inexistente_no_puede_crear(self):
        self.admin.perfil.activo = False
        self.admin.perfil.save(update_fields=["activo"])
        self.assertEqual(self.crear().status_code, 403)
        self.admin.perfil.delete()
        self.assertEqual(self.crear().status_code, 403)

    def test_error_al_crear_perfil_revierte_tambien_el_usuario(self):
        cantidad_anterior = get_user_model().objects.count()
        with patch("quality.services.PerfilUsuario.objects.create", side_effect=IntegrityError("fallo simulado")):
            respuesta = self.crear()
        self.assertEqual(respuesta.status_code, 400)
        self.assertNotIn("fallo simulado", str(respuesta.data))
        self.assertEqual(get_user_model().objects.count(), cantidad_anterior)
        self.assertEqual(LogEntry.objects.count(), 0)

    def test_registra_actor_sin_guardar_la_contrasena(self):
        respuesta = self.crear()
        self.assertEqual(respuesta.status_code, 201)
        evento = LogEntry.objects.get(action_flag=ADDITION)
        self.assertEqual(evento.user_id, self.admin.pk)
        self.assertEqual(evento.object_id, str(respuesta.data["id"]))
        self.assertNotIn("Roca-Delta_8!Luna_42", evento.change_message)
        self.assertNotIn("password", evento.change_message)

    def test_error_al_registrar_evento_revierte_usuario_y_perfil(self):
        cantidad_anterior = get_user_model().objects.count()
        perfiles_anteriores = PerfilUsuario.objects.count()
        with patch("quality.services.LogEntry.objects.log_actions", side_effect=IntegrityError("fallo simulado")):
            respuesta = self.crear()
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(get_user_model().objects.count(), cantidad_anterior)
        self.assertEqual(PerfilUsuario.objects.count(), perfiles_anteriores)
