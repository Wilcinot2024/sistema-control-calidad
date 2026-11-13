
from django.core.management.base import BaseCommand, CommandError
from quality.integraciones.gmail_service import recibir_sdi_desde_gmail


class Command(BaseCommand):
    """Consulta Gmail y coordina la recepción de solicitudes SDI."""

    help = "Consulta Gmail y procesa documentos SDI autorizados."

    def add_arguments(self, parser):
        # Cantidad máxima de mensajes por ejecución.
        parser.add_argument("--limite", type=int, default=20)

        # Solicitar explícitamente el procesamiento de documentos aprobados.
        parser.add_argument(
            "--importar",
            action="store_true",
            help="Solicita importar los documentos autorizados.",
        )

    def handle(self, *args, **options):
        try:
            resultado = recibir_sdi_desde_gmail(
                limite=options["limite"],
                ejecutar_importacion=options["importar"],
            )

        except Exception as error:
            # Evitar exponer credenciales o contenido privado en el registro.
            raise CommandError(
                f"Error de recepción Gmail: {type(error).__name__}"
            ) from None

        # Informar la cantidad de mensajes revisados.
        self.stdout.write(
            f"Correos revisados: {resultado['correos_revisados']}"
        )

        for mensaje in resultado["resultados"]:
            self.stdout.write(
                f"UID {mensaje['uid']}: {mensaje['estado']}"
            )

        self.stdout.write(
            self.style.SUCCESS("Recepción Gmail finalizada.")
        )
