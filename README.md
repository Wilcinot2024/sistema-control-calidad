# Sistema de control de calidad — Ancor Tecmin

Aplicación para gestionar solicitudes de inspección (SDI), productos, inspecciones visuales, evidencias, concesiones y trazabilidad. Incluye una interfaz React/Vite y una API Django con autenticación JWT.

La interfaz tiene dos modos: demostración con datos del navegador y sistema conectado con datos de la API. Cambiar de modo no transfiere registros. El correo y la puesta en producción requieren configuración y validación adicionales.

## Documentación

El [índice de documentación](documentacion/2026-10-13/LEEME.md) reúne los documentos necesarios para desarrollar, operar y entregar el proyecto. Incluye requisitos, arquitectura, datos, API, instalación, manual de usuario, pruebas, seguridad, despliegue y plantillas de entrega.

Los [manuales del 10 de octubre](documentacion/2026-10-10/LEEME.md) se conservan como referencia histórica en Markdown y PDF.

## Inicio local

En una terminal desde `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py setup_quality_user supervisor --role supervisor --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py setup_quality_user inspector --role inspector --area Calidad --settings=config.local_settings
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --settings=config.local_settings
```

En otra terminal desde `frontend`:

```powershell
npm.cmd install
npm.cmd run dev
```

Abre la dirección indicada por Vite y selecciona **Sistema conectado**. Los usuarios se crean con contraseña solicitada en consola. El entorno local usa SQLite; consulta la [instalación](documentacion/2026-10-13/05-instalacion-configuracion.md) para PostgreSQL y variables de entorno.

## Verificación

Desde `frontend`: `npm.cmd test` y `npm.cmd run build`.

Desde `backend`: `.\.venv\Scripts\python.exe manage.py test quality --settings=config.test_settings`.

Las comprobaciones automatizadas no sustituyen la aceptación con usuarios, PDF reales, correo autorizado y la base de datos del despliegue.
