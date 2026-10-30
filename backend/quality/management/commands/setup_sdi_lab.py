"""Cuentas reproducibles del laboratorio. No implementa el CRUD pendiente P-01."""

import json
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from quality.models import DepartamentoSDI, PerfilUsuario


class Command(BaseCommand):
    help = "Prepara exclusivamente usuarios lab.* y buzones ficticios, sin borrar SDI."

    @transaction.atomic
    def handle(self, *args, **options):
        if not getattr(settings, "LAB_ENABLED", False):
            raise CommandError("Solo puede ejecutarse con la configuración del laboratorio.")
        runtime = settings.LAB_RUNTIME
        runtime.mkdir(parents=True, exist_ok=True)
        archivo = runtime / "accesos.json"
        datos = json.loads(archivo.read_text(encoding="utf-8")) if archivo.exists() else {"password": secrets.token_urlsafe(16)}
        departamentos = {}
        for nombre, correo in [("Producción", "produccion@example.test"), ("Bodega", "bodega@example.test")]:
            departamentos[nombre], _ = DepartamentoSDI.objects.get_or_create(nombre=nombre, defaults={"correo": correo})
        cuentas = [
            ("lab.produccion", "solicitante", "Producción"),
            ("lab.produccion2", "solicitante", "Producción"),
            ("lab.bodega", "solicitante", "Bodega"),
            ("lab.inspector", "inspector", None),
            ("lab.inspector2", "inspector", None),
            ("lab.supervisor", "supervisor", None),
            ("lab.jefe", "jefe_calidad", None),
            ("lab.admin", "administrador", None),
        ]
        for username, rol, departamento in cuentas:
            user, _ = get_user_model().objects.get_or_create(username=username)
            user.email = username.replace("lab.", "") + "@example.test"
            user.first_name = username.replace("lab.", "").capitalize()
            user.is_active = True
            user.set_password(datos["password"])
            user.save()
            PerfilUsuario.objects.update_or_create(usuario=user, defaults={
                "rol": rol, "activo": True, "departamento": departamentos.get(departamento),
            })
        datos["cuentas"] = [{"username": c[0], "rol": c[1], "departamento": c[2]} for c in cuentas]
        archivo.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Ocho cuentas de ejemplo preparadas. Accesos locales: {archivo}"))
