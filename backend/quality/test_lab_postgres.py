"""Verificación real de bloqueo; se omite explícitamente en SQLite."""

from concurrent.futures import ThreadPoolExecutor
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone

from . import flow_services as flujo
from .models import DepartamentoSDI, NotificacionSDI, PerfilUsuario


@skipUnless(connection.vendor == "postgresql", "Requiere PostgreSQL; SQLite no acredita bloqueo de filas.")
class ConcurrenciaLaboratorioTests(TransactionTestCase):
    def test_inicio_concurrente_conserva_una_ocurrencia(self):
        depto = DepartamentoSDI.objects.create(nombre="Producción", correo="produccion@example.test")
        usuarios = {}
        for nombre, rol in [("sol", "solicitante"), ("supervisor", "supervisor"), ("ins", "inspector")]:
            user = get_user_model().objects.create_user(username=nombre, email=nombre + "@example.test")
            PerfilUsuario.objects.create(usuario=user, rol=rol, departamento=depto if rol == "solicitante" else None)
            usuarios[nombre] = user
        sdi = flujo.registrar(usuarios["sol"], {"flujo": "A", "activacion_proyecto": "1", "numero_sdi": "1", "fecha_emision": timezone.localdate(), "proyecto": "Concurrencia", "productos": [{"articulo": "Pieza", "cantidad_indicada": 1}]})
        flujo.asignar(usuarios["supervisor"], sdi.pk, usuarios["ins"].pk, [{"producto": sdi.items.get().pk, "cantidad": 1}])

        def iniciar():
            close_old_connections()
            try:
                user = get_user_model().objects.get(pk=usuarios["ins"].pk)
                return flujo.iniciar(user, sdi.pk).pk
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as ejecutores:
            self.assertEqual(list(ejecutores.map(lambda _: iniciar(), range(2))), [sdi.pk, sdi.pk])
        self.assertEqual(NotificacionSDI.objects.filter(sdi=sdi, evento="inicio").count(), 1)
        self.assertEqual(sdi.items.get().inspecciones.count(), 1)
