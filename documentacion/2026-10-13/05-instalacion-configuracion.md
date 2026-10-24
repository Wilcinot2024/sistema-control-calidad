# Instalación y configuración

## Requisitos del entorno

Python 3.12 o posterior según el README del backend y las dependencias declaradas; Node.js y npm compatibles con el proyecto Vite 5. Python y Node deben estar disponibles en el PATH. Confirma `python --version`, `node --version` y `npm.cmd --version` y registra las versiones empleadas en la entrega.

Las dependencias Python se declaran por rangos en `backend/requirements.txt`: Django `>=6.0,<6.1`, DRF, SimpleJWT, psycopg y pypdf. Frontend declara React 18, Vite 5 y plugin React. El comentario generado de `settings.py` menciona otra versión de Django; para instalar usa el manifiesto y verifica la versión realmente instalada.

## Backend local

Desde la raíz:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py setup_quality_user supervisor --role supervisor --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py setup_quality_user inspector --role inspector --area Calidad --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py check --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --settings=config.local_settings
```

Las contraseñas se introducen de forma interactiva. Si el usuario ya existe, el comando de creación falla: no repitas ese paso sobre usuarios existentes. El rol operativo administrador no implica acceso de superusuario al admin Django.

`config.local_settings` usa `backend/local.sqlite3`. `QUALITY_LOCAL_DB` permite elegir otro archivo para el entorno local. No uses `config.test_settings` para operar: crea SQLite en memoria y un hasher exclusivo de pruebas.

## Frontend

En otra terminal desde la raíz:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abre la URL que imprime Vite. El proxy `/api` apunta a `http://127.0.0.1:8000`. Para otro destino, crea `frontend/.env.local` con `API_PROXY_TARGET=http://127.0.0.1:8000` y reinicia Vite. No incluyas secretos en variables que termine recibiendo el navegador.

## PostgreSQL y entorno

`config.settings` configura actualmente base `control_calidad`, usuario `postgres`, host `localhost`, puerto `5433`. Nombre, usuario, host y puerto están escritos en código; no se leen variables `DB_HOST` o `DB_NAME`. Un despliegue con otros valores requiere ajustes explícitos de configuración.

Define `DJANGO_SECRET_KEY` y `DB_PASSWORD` en el proceso mediante tu gestor de secretos. Para producción define también `DJANGO_DEBUG=false` y `DJANGO_ALLOWED_HOSTS` con los hosts reales. Aplica migraciones usando `--settings=config.settings` sobre la base elegida, previa revisión y respaldo.

`backend/.env.example` es una referencia; Django **no carga `.env` automáticamente**. No almacenes contraseñas reales en el repositorio ni en estos documentos.

## Variables de correo

| Grupo | Variables |
| --- | --- |
| Recepción | SDI_IMAP_HOST, SDI_IMAP_USER, SDI_IMAP_PASSWORD o SDI_IMAP_OAUTH_TOKEN, SDI_IMAP_FOLDER |
| Remitentes | SDI_ALLOWED_SENDERS, direcciones separadas por coma |
| Salida | EMAIL_BACKEND, EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD |
| Transporte/remitente | EMAIL_USE_TLS, EMAIL_USE_SSL, DEFAULT_FROM_EMAIL |

La consola es el backend por defecto: los avisos no se consideran entregados. SMTP requiere `django.core.mail.backends.smtp.EmailBackend`, credenciales y un proveedor autorizado. Un token OAuth debe seguir vigente; su renovación depende del proveedor.

Desde backend, con las variables ya disponibles:

```powershell
.\.venv\Scripts\python.exe manage.py process_sdi_mail --once --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py process_sdi_mail --once --outbox-only --settings=config.local_settings
```

Estos comandos pueden recibir o enviar correos cuando se configura el proveedor. Ejecútalos únicamente sobre el buzón autorizado para la prueba. En operación el proceso sin `--once` necesita supervisión.

## Comprobación final

Confirma acceso conectado, usuario/perfil activo, catálogo de inspectores, creación de SDI y descarga protegida. Si ves registros de ejemplo, verifica el modo seleccionado. La guía de pruebas documenta la validación completa.
