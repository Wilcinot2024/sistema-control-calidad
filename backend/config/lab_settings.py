"""Configuración aislada: nunca utiliza la base operativa ni entrega correo."""

from .settings import *

LAB_ENABLED = True
SECRET_KEY = os.environ.get("SDI_LAB_SECRET", "solo-laboratorio-local-no-usar-en-produccion-2026")
DEBUG = False
ROOT_URLCONF = "config.lab_urls"
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]
DATABASES = {"default": {
    "ENGINE": "django.db.backends.postgresql",
    "NAME": os.environ.get("SDI_LAB_DB", "sdi_laboratorio"),
    "USER": os.environ.get("SDI_LAB_DB_USER", "sdi_lab"),
    "PASSWORD": os.environ.get("SDI_LAB_DB_PASSWORD", ""),
    "HOST": "127.0.0.1",
    "PORT": os.environ.get("SDI_LAB_DB_PORT", "55439"),
}}
if not DATABASES["default"]["NAME"].startswith("sdi_lab"):
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured("La base del laboratorio debe comenzar con sdi_lab.")
LAB_RUNTIME = Path(os.environ.get("SDI_LAB_RUNTIME", BASE_DIR.parent / "laboratorio-sdi" / "runtime"))
MEDIA_ROOT = LAB_RUNTIME / "archivos"
EMAIL_BACKEND = "django.core.mail.backends.dummy.EmailBackend"
SDI_REVIEWER_USERNAMES = [value.strip() for value in os.environ.get(
    "SDI_LAB_REVISORES", "lab.supervisor,lab.jefe,lab.admin",
).split(",") if value.strip()]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}
