from .settings import *

# Configuración exclusiva de pruebas: no utiliza PostgreSQL ni datos reales.
SECRET_KEY = "quality-tests-only-key-with-at-least-32-characters"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
