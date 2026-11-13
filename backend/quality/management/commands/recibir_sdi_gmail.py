
from django.core.management.base import BaseCommand, CommandError  # Comandos Django.
from quality.integraciones.gmail_service import recibir_sdi_desde_gmail  # Servicio Gmail.


class Command(BaseCommand):
    """Consulta Gmail para identificar solicitudes SDI."""

    help = "Consulta Gmail y valida los correos recibidos con documentos SDI."

    def add_arguments(self, parser):
        # Limita la cantidad de correos que se revisarán.
        parser.add_argument("--limite", type=int, default=20)

    def handle(self, *args, **options):
        try:
            # Consultar mensajes sin habilitar escrituras en PostgreSQL.
            resultado = recibir_sdi_desde_gmail(
                limite=options["limite"],
                ejecutar_importacion=False,
            )

        except Exception as error:
            # Informar el error sin mostrar credenciales.
            raise CommandError(
                f"No fue posible consultar Gmail: {type(error).__name__}"
            ) from error

        # Mostrar un resumen de la recepción.
        self.stdout.write(
            f"Correos revisados: {resultado['correos_revisados']}"
        )

        for mensaje in resultado["resultados"]:
            self.stdout.write(
                f"UID {mensaje['uid']}: {mensaje['estado']}"
            )

        self.stdout.write(
            self.style.SUCCESS("Consulta Gmail finalizada.")
        )
