from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Area, PerfilUsuario, SDI, ItemSDI, InspeccionSDI
from .serializers import SDISerializer, ItemSDISerializer, InspeccionSDISerializer


class AreaCatalogTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.usuario = get_user_model().objects.create_user(username="inspector_catalogo")
        self.area = Area.objects.create(nombre="Calidad")
        self.perfil = PerfilUsuario.objects.create(
            usuario=self.usuario, rol=PerfilUsuario.Rol.INSPECTOR, area=self.area,
        )
        self.url = reverse("areas_api")

    def authenticate(self):
        token = RefreshToken.for_user(self.usuario).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_requires_authenticated_user(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_returns_only_active_areas_sorted_and_read_only(self):
        Area.objects.create(nombre="Almacén")
        Area.objects.create(nombre="Oculta", activo=False)
        self.authenticate()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([area["nombre"] for area in response.data], ["Almacén", "Calidad"])
        self.assertEqual(response.data[1]["id"], self.area.id)
        self.assertEqual(self.client.post(self.url, {"nombre": "Nueva"}).status_code, 405)

    def test_inactive_profile_is_denied(self):
        self.perfil.activo = False
        self.perfil.save()
        self.authenticate()
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_missing_profile_is_denied(self):
        self.perfil.delete()
        self.authenticate()
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_entity_area_comes_from_inspector_profile_not_department(self):
        sdi = SDI.objects.create(
            activacion_proyecto="12", numero_sdi="1", fecha_emision=date(2026, 10, 10),
            proyecto="Prueba", departamento_solicitante="Compras", solicitante="Prueba", inspector=self.usuario,
        )
        item = ItemSDI.objects.create(sdi=sdi, orden=1, articulo="Prueba", cantidad_a_inspeccionar=5)
        other_area = Area.objects.create(nombre="Taller")
        other = get_user_model().objects.create_user(username="otro_inspector")
        PerfilUsuario.objects.create(usuario=other, rol=PerfilUsuario.Rol.INSPECTOR, area=other_area)
        inspection = InspeccionSDI.objects.create(item=item, numero_inspeccion=1, inspector=other, cantidad_inspeccionada=1)
        self.assertEqual(SDISerializer(sdi).data["area_inspector"]["id"], self.area.id)
        self.assertEqual(ItemSDISerializer(item).data["area_inspector"]["id"], self.area.id)
        self.assertEqual(InspeccionSDISerializer(inspection).data["area_inspector"]["id"], other_area.id)
        self.perfil.area = None
        self.perfil.save()
        sdi.refresh_from_db()
        self.assertIsNone(SDISerializer(sdi).data["area_inspector"])
