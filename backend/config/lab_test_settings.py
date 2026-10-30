"""Respaldo de pruebas sin TCP; no acredita concurrencia de PostgreSQL."""

from .lab_settings import *

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
