# Flujo de correo de SDI

Esta entrega se aplica sobre `revision-frontend` y conserva sus estados, asignaciones, inspecciones, revisiones y cierre. Añade recepción IMAP y entrega SMTP de avisos mediante `MAILERS`, conforme a Django 6.1.

## Qué hace

- Recibe los PDF FR-OPE-133 de remitentes autorizados y utiliza el parser existente del proyecto.
- Crea la SDI **pendiente y sin inspector**, agrega sus productos y registra el origen en el historial. El usuario operativo debe tener un perfil activo de administración, jefatura de calidad o supervisión.
- Conserva el PDF original en `RecepcionCorreoSDI`, dentro de la base de datos, junto con su hash, remitente y Message-ID.
- Evita duplicados por remitente y contenido del PDF, incluso si se reenvía con otro Message-ID. Si otro PDF tiene un código de SDI ya existente, no lo sobrescribe: el mensaje queda sin marcar como leído para revisión manual.
- Confirma todos los adjuntos de un mensaje en una sola transacción. El fallo de cualquiera revierte las altas de ese mensaje.
- Marca el mensaje como leído solo después de confirmar la recepción. Lee con `BODY.PEEK[]` y no borra mensajes.
- Avisa a Calidad al recibir una SDI. Procesa además los avisos de inicio, revisión y cierre que ya generan los servicios existentes.
- Para inicio/cierre de SDI recibidas por correo usa el remitente original; revisión y recepción usan el destinatario configurado para Calidad. Las SDI manuales utilizan el correo configurado para su departamento. Un `correo_destinatario` informado expresamente tiene prioridad.
- Guarda intentos, error resumido y próxima ejecución, con espera exponencial de hasta 24 horas. Una entrega SMTP confirmada marca el aviso como enviado; consola y otros destinos de prueba lo conservan pendiente.

Los PDF deben tener texto extraíble, no estar cifrados y no superar 10 MB ni 100 páginas. El mensaje completo admite hasta 25 MB. Los documentos escaneados requieren revisión manual; esta PR no añade OCR.

## Instalación

Desde la raíz, con las dependencias de `backend/requirements.txt` instaladas:

```powershell
python backend/manage.py migrate
```

La migración `0010_flujo_correo_sdi` continúa desde `0009_revisionsdi_item`; conserva avisos y SDI existentes. El respaldo debe incluir ahora la tabla de recepciones, porque almacena los PDF originales. La dependencia Pillow se declara porque el backend actual ya la importa al cargar las rutas.

## Configuración

El archivo `correo.env.example` enumera las variables. Exporta los valores en el entorno del proceso; Django no carga `.env` automáticamente. Nunca guardes claves reales en el repositorio.

Ejemplo de los datos no secretos en PowerShell:

```powershell
$env:SDI_CORREO_USUARIO = 'usuario_operativo_existente'
$env:SDI_CORREO_REMITENTES = '{"bodega@example.invalid":"Bodega","produccion@example.invalid":"Producción"}'
$env:SDI_CORREO_DESTINATARIOS = '{"Calidad":"jefatura@example.invalid","Bodega":"bodega@example.invalid","Producción":"produccion@example.invalid"}'
$env:SDI_IMAP_HOST = 'imap.del-proveedor'
$env:SDI_IMAP_USUARIO = 'buzon_autorizado'
$env:SDI_CORREO_DESDE = 'cuenta_remitente_autorizada'
```

Los departamentos admitidos por el flujo existente son `Calidad`, `Producción` y `Bodega`. La lista vacía de remitentes no autoriza ninguna recepción. Esta lista controla el encabezado From y debe acompañarse de la verificación antisuplantación del proveedor de correo.

Para recibir, configura **una** de `SDI_IMAP_PASSWORD` o `SDI_IMAP_OAUTH_TOKEN` según el proveedor. El token debe estar vigente; su renovación debe gestionarse fuera de este proceso. La conexión es IMAP con TLS. La integración corporativa de Microsoft Graph existente permanece independiente y sin cambios.

La salida utiliza consola por defecto. Para entrega real configura:

```powershell
$env:SDI_CORREO_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
$env:SDI_SMTP_HOST = 'smtp.del-proveedor'
$env:SDI_SMTP_PORT = '587'
$env:SDI_SMTP_TLS = 'true'
$env:SDI_SMTP_SSL = 'false'
$env:SDI_SMTP_USUARIO = 'cuenta_autorizada'
```

Proporciona `SDI_SMTP_PASSWORD` en el entorno del servicio y usa un método de autenticación autorizado por el proveedor. No actives TLS y SSL simultáneamente. Esta PR no implementa renovación OAuth ni transporte delegado de cuentas Outlook/Hotmail personales.

## Ejecutar

```powershell
# Una pasada: recepción y salida. Los fallos de recepción devuelven un código de error.
python backend/manage.py process_sdi_mail --once

# Procesar únicamente los avisos existentes.
python backend/manage.py process_sdi_mail --once --outbox-only

# Mantener el proceso, con hasta 100 mensajes y 100 avisos por pasada.
python backend/manage.py process_sdi_mail --interval 60 --limit 100
```

El proceso debe ejecutarse bajo supervisión en el entorno operativo. `--limit` admite 1–1000. Una recepción fallida no impide intentar la salida de avisos. No ejecutes dos receptores para el mismo buzón; si compiten, las restricciones de la base evitan altas duplicadas y el siguiente intento recupera los mensajes sin confirmar.

En PostgreSQL, el envío bloquea cada aviso durante la entrega para evitar que dos trabajadores lo procesen simultáneamente. SMTP puede repetir una entrega si el proceso se interrumpe después de la aceptación del servidor y antes de guardar el resultado; se mantiene un Message-ID estable, pero no se garantiza entrega exactamente una vez ni lectura del destinatario.

## Pruebas

```powershell
python backend/manage.py test quality --settings=config.correo_test_settings --noinput
python backend/manage.py check --settings=config.correo_test_settings
python backend/manage.py makemigrations --check --dry-run --settings=config.correo_test_settings
```

Las pruebas usan SQLite y archivos en memoria, IMAP/SMTP simulados y un PDF sintético procesado con el parser real. Incluyen migración desde el esquema anterior, deduplicación, reversión de adjuntos, permisos del usuario operativo, enrutamiento de avisos, reintentos y conservación de la marca de lectura. Antes de activar el servicio faltan pruebas operativas con el buzón autorizado, PDF empresariales y PostgreSQL.
