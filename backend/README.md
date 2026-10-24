# Flujo operativo de calidad

La API ahora distingue recepción pendiente, asignación, inspección, revisión de resultados y cierre. Una SDI recibida puede tener datos incompletos e inspector vacío. El PDF original y la propuesta de lectura quedan conservados; las correcciones se guardan como datos oficiales y eventos del historial.

## Arranque local

Desde `backend`, con Python 3.12 o posterior:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate --settings=config.local_settings
python manage.py setup_quality_user supervisor --role supervisor --settings=config.local_settings
python manage.py setup_quality_user inspector --role inspector --area Calidad --settings=config.local_settings
python manage.py runserver 127.0.0.1:8000 --settings=config.local_settings
```

El comando solicita las contraseñas sin guardarlas en archivos. `config.local_settings` utiliza `local.sqlite3`, independiente de PostgreSQL. El frontend conserva la demostración y ofrece **Sistema conectado** en la cabecera para iniciar sesión con estos usuarios. Vite reenvía `/api` al puerto 8000. En producción, sirve frontend y API bajo el mismo origen o configura el proxy equivalente.

Para PostgreSQL usa `config.settings`, define `DJANGO_SECRET_KEY` y `DB_PASSWORD`, instala las dependencias y aplica las migraciones antes de iniciar. `0004` agrega recepción, documentos, cantidades originales, asignación, revisión y bandeja de avisos; `0005` conserva la asignación de SDI anteriores que ya tienen inspecciones. No se modificó la base PostgreSQL durante el desarrollo.

## Reglas aplicadas

| Etapa / campo | Comportamiento | Motivo |
| --- | --- | --- |
| Recepción | PDF válido de hasta 20 MB, sin contraseña, hasta 100 páginas | Guardar y analizar el documento con límites de procesamiento. |
| Propuesta PDF | Código, proyecto, solicitante, departamento, fecha y productos cuando aparecen etiquetados | La extracción es conservadora; Jefe/Supervisor confirma los datos. |
| Código proyecto / SDI | Proyecto de 1 a 6 dígitos; número solo dígitos | Mantener formato del código y ceros iniciales. |
| Fecha emisión | Desde 1 de enero del año anterior hasta hoy en Santiago | La regla acordada con el usuario también se valida al guardar y asignar. |
| Artículo | Letras, números, espacios, puntos y guiones; hasta 250 caracteres | Restricción acordada y tamaño del modelo. |
| Orden producto | Mayor orden de su SDI + 1; no editable | Evitar orden arbitrario o duplicado. |
| Cantidad indicada | Entero positivo opcional, separado de cantidad a inspeccionar | Preservar lo recibido de Producción/Bodega sin asumir que se inspecciona todo. |
| Cantidad a inspeccionar | Entero >= 1, no supera indicada cuando está informada | Confirmar alcance antes de asignar. |
| Asignar | Datos obligatorios revisados, correo de origen, productos e inspector activo | Asignación explícita; crea una inspección inicial por producto y aviso en cola. |
| Visibilidad inspector | Únicamente SDI asignadas a ese inspector | La recepción pendiente pertenece a Jefe/Supervisor. |
| Documentos y evidencias | Descarga autenticada con los permisos de la SDI | El servidor no expone `/media` como carpeta pública. |
| Finalizar inspección | Siete criterios visuales obligatorios y cantidad aprobada de 0 hasta inspeccionada | 0 rechaza, cantidad intermedia da resultado parcial y totalidad exige visual conforme. |
| Reinspección / concesión | Se mantienen las condiciones de los servicios del backend | Resolver pendientes sin omitir validaciones existentes. |
| Revisión / cierre | Revisión explícita de Jefe/Supervisor; todas las inspecciones terminadas, productos resueltos y sin concesiones pendientes | El cierre exige confirmación humana y trazabilidad. Un cambio de resultados invalida la revisión. |
| Dashboard conectado | Cuenta SDI, productos e inspecciones por separado; resultados por revisar y áreas del catálogo real | No mezcla cantidades de entidades ni inventa áreas. |
| Retirar producto | Jefe/Supervisor/Administrador; SDI pendiente y sin asignar, producto sin inspecciones; confirmación en pantalla | Corrige registros agregados por error. Se conserva el PDF y se registra una copia descriptiva del producto retirado en el historial. |
| Anular SDI | Jefe/Supervisor/Administrador; pendiente, sin asignación ni inspecciones; motivo obligatorio de 1 a 1000 caracteres | Estado final `anulada`; conserva PDF, productos y trazabilidad. No se reactiva ni se reasigna; su código sigue reservado. |
| Archivar / restaurar | Jefe/Supervisor/Administrador; SDI en proceso, con resultados, cerrada o anulada; las pendientes deben revisarse o anularse | Oculta la SDI y sus registros asociados de la lista y contadores habituales. No cambia su estado ni impide consultar documentos. Restaurar una anulada no la reactiva. |

La migración `0006` añade los datos de anulación y archivo, sin eliminar registros anteriores. Aplícala antes de usar estas acciones (`python manage.py migrate` con los ajustes de tu entorno).

`GET /api/sdi/` muestra activas por defecto. `?vista=anuladas`, `archivadas` o `todas` permite consultar los registros conservados, siempre con los mismos permisos por inspector. `POST /api/sdi/{id}/anular/` recibe `{ "motivo": "..." }`; `POST /api/sdi/{id}/archivo/` recibe `{ "archivar": true }` para archivar o `false` para restaurar. El historial registra usuario y fecha en ambas acciones. Las SDI e inspecciones no admiten DELETE; el administrador Django tampoco ofrece su borrado ni el de productos, para evitar saltarse las reglas de retirada de la API.

La demostración ofrece estas acciones en el detalle y las vistas Activas, Anuladas, Archivadas y Productos retirados en Actividades. Sus registros permanecen en el navegador y no modifican el backend. En el sistema conectado el archivo se aplica a la SDI completa, con sus productos e inspecciones.

## Correo configurable

El proveedor está pendiente de definición. `backend/.env.example` enumera las variables; expórtalas en el proceso o en tu gestor de secretos. No se carga `.env` automáticamente. IMAP usa TLS y recibe mensajes no leídos con PDF adjunto. `SDI_ALLOWED_SENDERS` puede restringir remitentes por dirección; esa lista no reemplaza la verificación antisuplantación del proveedor. El destinatario se revisa en el formulario antes de asignar. Para OAuth configura un token vigente; la renovación específica depende del proveedor elegido.

```powershell
python manage.py process_sdi_mail --settings=config.local_settings
# Una pasada, para diagnóstico:
python manage.py process_sdi_mail --once --settings=config.local_settings
# Procesar únicamente la bandeja de salida:
python manage.py process_sdi_mail --once --outbox-only --settings=config.local_settings
```

En el despliegue ejecuta este proceso como servicio supervisado. Los mensajes recibidos se identifican por remitente, Message-ID y hash del PDF para no duplicar SDI al reintentar. Solo se marcan leídos después de registrar los adjuntos; no se borran del buzón. Los avisos de asignación y cierre se guardan en la misma transacción que la acción; SMTP se procesa después, con reintentos y estado visible en la SDI. Una entrega SMTP confirmada significa aceptación del servidor, no lectura del destinatario. Ante una interrupción entre entrega y guardado, SMTP puede repetir un aviso; se conserva un Message-ID estable.

Por defecto se usa consola y los avisos permanecen en cola. No se enviaron correos externos durante las pruebas. Cuando se defina el proveedor configura SMTP, remitente y credenciales, y comprueba recepción y entrega con un buzón autorizado.

## Lectura de PDF

La extracción reconoce texto seleccionable con etiquetas como `Proyecto:`, `Fecha:`, `Producto:` / `Artículo:`, `Descripción:` y `Cantidad:`. La propuesta y el texto extraído permanecen disponibles para auditoría. Los PDF escaneados quedan registrados para revisión manual y muestran una advertencia; no hay OCR instalado. El ajuste fino de tablas y formatos requiere muestras reales de las SDI de Producción/Bodega. No se envía contenido a servicios de IA externos.

## Verificación

```powershell
python manage.py test quality --settings=config.test_settings
python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

Las pruebas utilizan SQLite en memoria, archivos en memoria y correo simulado. Cubren recepción, deduplicación, asignación, permisos, documentos, inspección, revisión, cierre y reintentos. No acceden a PostgreSQL ni al buzón real.
