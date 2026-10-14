# Despliegue y mantenimiento

Estado: guía de preparación; no consta despliegue productivo ni restauración completa validada.

## Preparación de una versión

1. Identifica commit/versión, dependencias instaladas y cambios de esquema.
2. Ejecuta pruebas, compilación y revisión de migraciones del plan de pruebas.
3. Valida el flujo conectado y los roles en un entorno separado con PostgreSQL.
4. Define servidor, dominio, HTTPS, secretos, cuenta de base de datos, respaldo y proveedor de correo.
5. Respalda base y archivos antes de aplicar migraciones sobre datos existentes.
6. Aplica migraciones con los ajustes del entorno y publica la compilación del frontend.
7. Configura el servidor de aplicación Django, el proxy `/api` y el proceso supervisado de correo.
8. Ejecuta comprobaciones funcionales y registra evidencias y responsable.

`npm.cmd run build` genera `frontend/dist`. El servidor y el proxy de producción aún no están definidos en este paquete. `runserver` y la vista previa Vite son herramientas de desarrollo; se requiere configuración específica para servir producción.

Los ajustes actuales no declaran `STATIC_ROOT`; antes de usar `collectstatic` debe definirse la configuración de estáticos del despliegue. No se incluye aquí una receta de infraestructura ya validada.

## Respaldos y restauración

Respalda la base de datos y `backend/media` como conjunto consistente. En SQLite detén escrituras o utiliza un mecanismo de copia consistente. En PostgreSQL usa el mecanismo de respaldo del entorno. Incluye documentos, evidencias y documentos de concesión; una copia solo de la base no conserva los archivos.

Define frecuencia, retención, cifrado, acceso y ubicación externa con la empresa. Registra inicio/fin, versión, tamaño y resultado. La periodicidad debe responder al máximo de datos que la empresa admite perder; no hay un objetivo de recuperación aprobado.

Para probar restauración: selecciona copia, prepara entorno aislado compatible, restaura base y media, revisa migraciones, inicia servicios y comprueba una SDI con documentos/historial. Mantén deshabilitado el envío real de correo durante la prueba. Documenta tiempo y errores antes de declarar el respaldo recuperable.

## Actualización y recuperación

Prueba cambios y migraciones sobre copia representativa antes de publicar. Conserva la versión previa y un respaldo verificable. Volver al código anterior puede no ser compatible con un esquema nuevo; define recuperación por versión y evita ejecutar migraciones inversas sin revisar su efecto en los datos.

## Diagnóstico

| Incidencia | Comprobación |
| --- | --- |
| Frontend sin API | Proceso Django, proxy `/api`, origen y destino configurado |
| Error de base | Servicio, puerto 5433 actual, permisos, contraseña, migraciones |
| Autenticación o acceso | Usuario/perfil activos, rol, asignación y sesión |
| Avisos acumulados | Supervisor del proceso de correo, SMTP, error/intentos |
| PDF sin propuesta | Texto seleccionable, límites, formato y revisión manual |
| Archivo ausente | Referencia de base, ruta media y respaldo correspondiente |

No borres ni edites estados directamente para solucionar bloqueos. Conserva logs útiles sin contraseñas/tokens y reproduce errores en un entorno separado.

## Tareas periódicas propuestas

Revisar respaldos y espacio de archivos, cuentas activas, cola de avisos y errores; probar recuperación y revisar dependencias con frecuencia acordada. Registrar responsable y fecha de cada actividad. La eliminación de datos antiguos necesita política aprobada y desarrollo de un procedimiento compatible con la trazabilidad.
