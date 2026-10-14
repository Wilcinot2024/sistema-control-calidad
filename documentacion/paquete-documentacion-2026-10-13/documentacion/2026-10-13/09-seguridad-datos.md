# Seguridad y tratamiento de datos

Este documento describe controles del código y decisiones operativas pendientes. No constituye una auditoría de seguridad ni una declaración de cumplimiento normativo.

## Acceso

JWT identifica la sesión conectada; las operaciones de dominio comprueban rol y perfil activo. Los roles de gestión reciben/corrigen/asignan/revisan/cierran. Inspector consulta SDI asignadas y trabaja sus propias inspecciones. La autorización se valida en servidor aunque un botón esté disponible en la pantalla.

Los tokens del frontend conectado están en `sessionStorage`. Un ataque que ejecute código en la página puede acceder a ese almacenamiento: deben revisarse dependencias, contenido inyectado y políticas del servidor antes de producción. Cerrar sesión elimina la sesión local; no se debe afirmar revocación global de todos los tokens emitidos.

## Datos y archivos

El sistema conserva identidad de usuarios, solicitantes, correos, datos del proyecto, documentos, evidencias e historial. PDF y evidencias pueden contener información empresarial. Usa muestras autorizadas para pruebas y evita incluir datos privados en capturas, CSV, incidencias o repositorios.

Las descargas están protegidas por rutas API. No publiques `backend/media` como directorio web. Un límite de tamaño no constituye análisis antimalware: no se acredita un escáner de archivos en esta implementación.

## Secretos y configuración

`DJANGO_SECRET_KEY`, `DB_PASSWORD`, credenciales IMAP/SMTP y tokens OAuth se suministran desde el entorno o gestor de secretos. `.env.example` solo enumera variables. Revisa archivos antes de compartir un ZIP del código; no incluyas `.env`, base local, media, tokens o credenciales.

Producción requiere DEBUG desactivado, hosts definidos, HTTPS, una cuenta de base de datos con permisos acordados y controles del servidor. La configuración actual usa `postgres`; definir un usuario restringido requiere adaptar los ajustes del despliegue.

## Correo

IMAP usa TLS y admite credenciales o token OAuth. `SDI_ALLOWED_SENDERS` restringe direcciones, pero no reemplaza las verificaciones antisuplantación del proveedor. Los mensajes no se eliminan del buzón; se marcan leídos después del registro de adjuntos.

SMTP confirmado acredita aceptación del servidor, no lectura del destinatario. Una interrupción puede repetir un aviso. Evita presentar el envío como garantía de notificación efectiva sin seguimiento empresarial.

## Decisiones que debe formalizar la empresa

| Decisión | Estado |
| --- | --- |
| Quién autoriza altas, bajas y cambios de rol | Pendiente de designación |
| Plazo de conservación de SDI, evidencias, correo y respaldos | Pendiente de política |
| Acceso autorizado a exportaciones y copias | Pendiente de política |
| Ubicación, protección y responsables de respaldos | Pendiente de infraestructura |
| Procedimiento de incidentes y recuperación de credenciales | Pendiente de aprobación |
| Revisión de obligaciones aplicables a datos/documentos | Pendiente con responsables de la empresa |

Archivo y anulación conservan datos; no equivalen a eliminación. El historial en base de datos aporta trazabilidad operativa, pero no acredita almacenamiento inmutable o firma digital.
