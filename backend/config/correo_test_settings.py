"""Pruebas del flujo de correo y regresión; base y archivos solo en memoria."""
from .settings import *

SECRET_KEY = "correo-tests-only-key-with-at-least-32-characters"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
MAILERS = {"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}}
ALLOWED_HOSTS = ["testserver", "127.0.0.1", "localhost"]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
