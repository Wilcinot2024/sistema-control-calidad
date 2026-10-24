import time
from django.core.management.base import BaseCommand
from quality.mail import poll_mailbox, send_notifications


class Command(BaseCommand):
    help = "Recibe SDI por IMAP y procesa avisos SMTP. Configura el proveedor mediante variables de entorno."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--interval", type=int, default=60)
        parser.add_argument("--outbox-only", action="store_true")

    def handle(self, *args, **options):
        try:
            while True:
                if not options["outbox_only"]:
                    try:
                        for error in poll_mailbox():
                            self.stderr.write(error)
                    except Exception as exc:
                        self.stderr.write(f"Recepción pendiente de configuración o conexión: {type(exc).__name__}")
                self.stdout.write(f"Avisos entregados: {send_notifications()}")
                if options["once"]:
                    return
                time.sleep(max(10, options["interval"]))
        except KeyboardInterrupt:
            return
