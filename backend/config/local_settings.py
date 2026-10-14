from .settings import *

# Entorno local opcional: no modifica la base PostgreSQL configurada.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'local-development-only-key-change-before-deployment')
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': os.environ.get('QUALITY_LOCAL_DB', str(BASE_DIR / 'local.sqlite3'))}}
