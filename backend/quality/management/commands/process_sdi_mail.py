import time
from django.core.management.base import BaseCommand, CommandError
from quality.correo import consultar_buzon, enviar_avisos


class Command(BaseCommand):
    help = "Recibe SDI por IMAP y entrega los avisos pendientes por SMTP."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--outbox-only", action="store_true")
        parser.add_argument("--interval", type=int, default=60)
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        if not 1 <= options["limit"] <= 1000:
            raise CommandError("--limit debe estar entre 1 y 1000.")
        try:
            while True:
                errores = []
                if not options["outbox_only"]:
                    try:
                        errores = consultar_buzon(options["limit"])
                    except Exception as error:
                        errores = [f"Recepción no completada: {type(error).__name__}. Revisa la configuración y el buzón."]
                enviados = enviar_avisos(options["limit"])
                for error in errores:
                    self.stderr.write(error)
                self.stdout.write(f"Avisos entregados: {enviados}")
                if options["once"]:
                    if errores:
                        raise CommandError("Recepción incompleta; los correos fallidos conservan su marca de lectura.")
                    return
                time.sleep(max(10, options["interval"]))
        except KeyboardInterrupt:
            return
