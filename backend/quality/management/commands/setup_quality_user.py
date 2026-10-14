from getpass import getpass
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from quality.models import PerfilUsuario, Area


class Command(BaseCommand):
    help = "Crea un usuario operativo con contraseña solicitada en consola."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("--role", required=True, choices=PerfilUsuario.Rol.values)
        parser.add_argument("--area")

    def handle(self, *args, **options):
        user_model = get_user_model()
        if user_model.objects.filter(username=options["username"]).exists():
            raise CommandError("Ese usuario ya existe.")
        password = getpass("Contraseña: ")
        if password != getpass("Repite la contraseña: "):
            raise CommandError("Las contraseñas no coinciden.")
        candidate = user_model(username=options["username"])
        validate_password(password, candidate)
        user = user_model.objects.create_user(username=options["username"], password=password)
        area = Area.objects.get_or_create(nombre=options["area"])[0] if options["area"] else None
        PerfilUsuario.objects.create(usuario=user, rol=options["role"], area=area)
        self.stdout.write("Usuario y perfil creados.")
