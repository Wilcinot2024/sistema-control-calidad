
from datetime import date  # Permite definir fechas de prueba.
from unittest.mock import patch  # Simula el parser y los permisos.
from django.contrib.auth import get_user_model  # Utiliza el usuario del proyecto.
from django.core.exceptions import ValidationError  # Comprueba errores controlados.
from django.test import TestCase  # Ejecuta pruebas aisladas de Django.

from quality.models import SDI, ItemSDI  # Modelos que verificaremos.
from quality.services import crear_item_sdi  # Servicio original de productos.
from quality.integraciones.sdi_import_service import importar_sdi_desde_pdf


class ImportacionSDITests(TestCase):
    """Comprueba la importación sin modificar las SDI reales."""

    def setUp(self):
        # Crear un usuario solamente en la base de pruebas.
        self.usuario = get_user_model().objects.create_user(
            username="operador_importacion_test",
            password="ClaveTemporalSoloPruebas123!",
        )
        self.pdf = b"%PDF-1.4 documento de prueba simulado"

        # Simular datos que normalmente entregaría el parser FR-OPE-133.
        self.datos = {
            "datos_generales": {
                "prefijo_bod": False,
                "activacion_proyecto": "987654",
                "numero_sdi": "12345",
                "fecha_emision": "2026-11-10",
                "proyecto": "Proyecto de prueba",
            },
            "articulos": [
                {
                    "orden": 1,
                    "codigo_plano": "PL-001",
                    "articulo": "Producto A",
                    "cantidad_a_inspeccionar": 5,
                    "observaciones": "",
                },
                {
                    "orden": 2,
                    "codigo_plano": "PL-001",
                    "articulo": "Producto B",
                    "cantidad_a_inspeccionar": 3,
                    "observaciones": "",
                },
            ],
        }

        # Evitar depender de perfiles reales durante estas pruebas.
        self.permisos = patch("quality.services.validar_rol")
        self.permisos.start()
        self.addCleanup(self.permisos.stop)

        # Simular únicamente la lectura del PDF.
        self.parser = patch(
            "quality.integraciones.sdi_import_service.procesar_pdf_sdi",
            return_value=self.datos,
        )
        self.parser.start()
        self.addCleanup(self.parser.stop)

    def importar(self):
        # Ejecutar nuestro servicio utilizando datos aislados.
        return importar_sdi_desde_pdf(
            contenido_pdf=self.pdf,
            usuario_actual=self.usuario,
            departamento_solicitante="Producción",
            solicitante="Solicitante de prueba",
        )

    def test_crea_sdi_pendiente_sin_inspector(self):
        # Comprobar estado y datos generales.
        sdi = self.importar()

        self.assertEqual(sdi.estado, SDI.Estado.PENDIENTE)
        self.assertIsNone(sdi.inspector_id)
        self.assertEqual(sdi.departamento_solicitante, "Producción")
        self.assertEqual(sdi.fecha_emision, date(2026, 11, 10))
        self.assertEqual(SDI.objects.count(), 1)

    def test_registra_productos_sin_agrupar_codigos(self):
        # Los códigos de plano repetidos deben conservarse.
        sdi = self.importar()
        productos = list(
            ItemSDI.objects.filter(sdi=sdi).order_by("orden")
        )

        self.assertEqual(len(productos), 2)
        self.assertEqual(productos[0].codigo_plano, "PL-001")
        self.assertEqual(productos[1].codigo_plano, "PL-001")
        self.assertEqual(productos[0].cantidad_a_inspeccionar, 5)
        self.assertEqual(productos[1].cantidad_a_inspeccionar, 3)

    def test_impide_importacion_duplicada(self):
        # Importar dos veces el mismo identificador debe fallar.
        self.importar()

        with self.assertRaises(ValidationError):
            self.importar()

        self.assertEqual(SDI.objects.count(), 1)
        self.assertEqual(ItemSDI.objects.count(), 2)

    def test_revierte_operacion_si_falla_segundo_producto(self):
        # Simular un fallo después de crear el primer producto.
        def crear_producto_controlado(*args, **kwargs):
            if kwargs["orden"] == 2:
                raise ValidationError("Error simulado del producto 2.")
            return crear_item_sdi(*args, **kwargs)

        with patch(
            "quality.integraciones.sdi_import_service.crear_item_sdi",
            side_effect=crear_producto_controlado,
        ):
            with self.assertRaises(ValidationError):
                self.importar()

        # La transacción debe eliminar también la SDI recién creada.
        self.assertEqual(SDI.objects.count(), 0)
        self.assertEqual(ItemSDI.objects.count(), 0)

    def test_rechaza_departamento_no_autorizado(self):
        # Solo se permiten Calidad, Producción y Bodega.
        with self.assertRaises(ValidationError):
            importar_sdi_desde_pdf(
                contenido_pdf=self.pdf,
                usuario_actual=self.usuario,
                departamento_solicitante="Producción_bodega",
                solicitante="Solicitante de prueba",
            )

        self.assertEqual(SDI.objects.count(), 0)

    def test_importacion_pdf_real_nueve_productos(self):
        """Valida el PDF real y registra sus productos solo en la BD de pruebas."""
        from pathlib import Path  # Localiza el PDF utilizado en la prueba.
        from quality.integraciones.sdi_pdf_parser import procesar_pdf_sdi

        # 1. Localizar el documento real en la carpeta backend.
        ruta = Path(__file__).resolve().parent.parent / "SDI-987-72 Accesorios.pdf"
        if not ruta.is_file():
            self.skipTest("PDF empresarial no disponible en este entorno de pruebas.")
        contenido_pdf = ruta.read_bytes()

        # 2. Extraer los datos con el parser real, sin simulación.
        datos = procesar_pdf_sdi(contenido_pdf)
        self.assertEqual(datos["datos_generales"]["numero_sdi"], "72")
        self.assertEqual(len(datos["articulos"]), 9)

        # 3. Utilizar un identificador ficticio solo en la base de pruebas.
        datos["datos_generales"]["numero_sdi"] = "990001"

        # 4. Reutilizar el servicio de importación y sus validaciones.
        with patch(
            "quality.integraciones.sdi_import_service.procesar_pdf_sdi",
            return_value=datos,
        ):
            sdi = importar_sdi_desde_pdf(
                contenido_pdf=contenido_pdf,
                usuario_actual=self.usuario,
                departamento_solicitante="Producción",
                solicitante="Solicitante de prueba",
            )

        # 5. Comprobar el estado administrativo de la SDI.
        self.assertEqual(sdi.estado, SDI.Estado.PENDIENTE)
        self.assertIsNone(sdi.inspector_id)
        self.assertEqual(sdi.numero_sdi, "990001")

        # 6. Verificar los nueve productos y sus cantidades individuales.
        productos = list(ItemSDI.objects.filter(sdi=sdi).order_by("orden"))
        self.assertEqual(len(productos), 9)
        cantidades = [item.cantidad_a_inspeccionar for item in productos]
        self.assertEqual(cantidades, [5, 5, 6, 6, 6, 12, 5, 17, 12])

        # 7. Conservar códigos de plano repetidos sin agrupar artículos.
        self.assertEqual(productos[0].codigo_plano, productos[1].codigo_plano)
        self.assertEqual(productos[3].codigo_plano, productos[4].codigo_plano)

        # 8. Verificar que solo se haya registrado la SDI ficticia.
        self.assertEqual(SDI.objects.count(), 1)
        self.assertEqual(ItemSDI.objects.count(), 9)
