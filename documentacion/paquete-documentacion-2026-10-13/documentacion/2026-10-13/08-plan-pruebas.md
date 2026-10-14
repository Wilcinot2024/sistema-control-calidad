# Plan de pruebas y aceptación

Fecha: 13 de octubre de 2026. Esta edición documenta pruebas existentes y casos propuestos; **no ejecutó nuevamente las suites de aplicación** ni certifica resultados actuales. Los conteos de la edición anterior son evidencia histórica, no resultados de esta entrega documental.

## Verificación automatizada

Desde frontend:

```powershell
npm.cmd test
npm.cmd run build
```

Desde backend:

```powershell
.\.venv\Scripts\python.exe manage.py test quality --settings=config.test_settings
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run --settings=config.test_settings
.\.venv\Scripts\python.exe manage.py check --settings=config.local_settings
```

Backend prueba con SQLite en memoria y correo simulado. Las suites no validan un buzón externo ni la configuración PostgreSQL productiva. Frontend usa `node --test`; la compilación no sustituye una revisión del navegador.

## Cobertura existente

`quality/test_workflow.py` incluye recepción/deduplicación, asignación, visibilidad, ciclo inspección-revisión-cierre, evidencias, correo simulado, archivo, anulación y retiro. `quality/tests.py` valida catálogo de áreas y perfiles.

`frontend/tests` cubre campos, CSV, áreas, indicadores, cliente de flujo y disponibilidad de acciones. `src/pages/recordLifecycle.test.js` verifica conservación de registros demo. Consulta esos archivos para conocer las aserciones exactas.

## Casos manuales de aceptación

| Caso | Requisitos | Procedimiento y resultado esperado |
| --- | --- | --- |
| PA-01 | RF-01, RF-06 | Acceso por cada rol y perfil inactivo; acceso denegado cuando corresponde |
| PA-02 | RF-02, RF-04 | Crear SDI y productos; corregir antes de asignar, bloquear cambios posteriores |
| PA-03 | RF-03 | PDF seleccionable y escaneado; preservar original y advertir necesidad de revisión |
| PA-04 | RF-03 | Reintentar recepción idéntica; comprobar que no duplica el registro |
| PA-05 | RF-05, RN-01/04 | Intentar asignación con datos/cantidades inválidos; corregir y asignar correctamente |
| PA-06 | RF-06, RF-08 | Inspector ajeno solicita detalle y archivo por ID; no obtiene contenido protegido |
| PA-07 | RF-07, RN-05 | Finalizar con 0, parte y totalidad; comprobar cantidades y conformidad visual |
| PA-08 | RF-09, RN-06 | Reinspección/concesión y cambio de resultados; revisión anterior deja de ser válida |
| PA-09 | RF-10 | Intentar cierre prematuro; resolver pendientes, revisar y cerrar correctamente |
| PA-10 | RF-11/12 | Anular con motivo y comprobar documento/historial; bloquear asignación posterior |
| PA-11 | RF-13 | Archivar/restaurar y comprobar estado, contadores y visibilidad por rol |
| PA-12 | RF-15 | Buzón autorizado, recepción, aviso y fallo SMTP; registrar entrega/reintento real |
| PA-13 | RF-16 | Demo: exportar con ceros, saltos y caracteres; comprobar contenido y filtros |
| PA-14 | RNF-02/06 | PostgreSQL: operación concurrente y restauración de base + media en entorno separado |

PA-12 y PA-14 permanecen pendientes mientras no existan proveedor e infraestructura autorizados. La prueba con datos reales requiere autorización de la empresa.

## Registro de ejecución

Completa una fila por ejecución y guarda evidencias sin secretos:

| Fecha | Versión/commit | Caso/comando | Entorno | Resultado | Evidencia | Responsable |
| --- | --- | --- | --- | --- | --- | --- |
| Por completar | Por completar | Por completar | Por completar | No ejecutado | Por completar | Por completar |

Resultados permitidos: aprobado, fallido, bloqueado o no ejecutado. Para un defecto registra pasos, esperado, observado, impacto y evidencia. La aceptación requiere criterios acordados, casos críticos aprobados y observaciones pendientes explícitas.
