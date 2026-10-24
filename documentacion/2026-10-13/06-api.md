# Referencia de API

Base: `/api/`. Fuente de rutas: `backend/config/urls.py` y `backend/quality/urls.py`. Este documento resume el contrato vigente; serializers y funciones de endpoint determinan los campos y respuestas exactos.

## Autenticación y formatos

`POST /api/token/` recibe `username` y `password` y devuelve `access` y `refresh`. `POST /api/token/refresh/` recibe `refresh`. Las rutas de dominio usan `Authorization: Bearer <access>` y validan perfil activo. No publiques tokens en capturas o informes.

JSON para operaciones ordinarias; `multipart/form-data` para archivos. Los IDs en las rutas son enteros de base de datos. El código visible de la SDI no sustituye su ID.

## Endpoints

| Método | Ruta después de /api/ | Función |
| --- | --- | --- |
| GET | me/ | Usuario y perfil |
| GET | areas/ | Áreas activas, ordenadas |
| GET | dashboard/ | Conteos según visibilidad |
| GET, POST | sdi/ | Listar / crear recepción manual |
| POST | sdi/recepcion/ | PDF, correo_origen y asunto_correo opcional |
| GET, PATCH | sdi/{id}/ | Detalle compuesto / corregir recepción |
| GET, POST | sdi/{id}/items/ | Productos / agregar |
| GET, PATCH, DELETE | items/{id}/ | Consultar / corregir / retirar si es elegible |
| POST | sdi/{id}/asignar/ | Inspector e instrucciones |
| POST | sdi/{id}/revisar/ | Revisión de resultados |
| POST | sdi/{id}/cerrar/ | Cierre validado |
| POST | sdi/{id}/anular/ | Anulación con motivo |
| POST | sdi/{id}/archivo/ | Archivar o restaurar |
| GET | sdi/{id}/historial/ | Eventos |
| GET | documentos/{id}/archivo/ | PDF original autorizado |
| GET, POST | inspectores/ | Consulta / alta según permisos |
| PATCH | inspectores/{id}/estado/ | Activación del inspector |
| GET, POST | items/{id}/inspecciones/ | Consulta / creación validada |
| POST | items/{id}/reinspecciones/ | Crear reinspección |
| GET | inspecciones/{id}/ | Detalle de inspección |
| GET, POST, PATCH | inspecciones/{id}/visual/ | Consulta / registro / edición visual |
| POST | inspecciones/{id}/aprobar/ | Finalizar con cantidad aprobada |
| POST | inspecciones/{id}/rechazar/ | Registrar rechazo según contrato del servicio |
| POST | inspecciones/{id}/evidencias/ | Adjuntar archivo |
| GET | evidencias/{id}/archivo/ | Descargar evidencia autorizada |
| GET, POST | inspecciones/{id}/concesiones/ | Consulta / solicitud |
| PATCH | concesiones/{id}/resolver/ | Decisión aprobada o rechazada |

`GET sdi/?vista=activas` es la vista por defecto; admite `anuladas`, `archivadas` y `todas`. Los permisos se mantienen en cualquier vista. No hay DELETE de SDI ni de inspecciones. El detalle de inspección publicado admite GET; no se debe asumir PATCH por analogía con productos.

## Ejemplos JSON

Registro manual, `POST sdi/`:

```json
{
  "prefijo_bod": false,
  "activacion_proyecto": "001234",
  "numero_sdi": "0001",
  "fecha_emision": "2026-10-13",
  "proyecto": "Proyecto de prueba",
  "departamento_solicitante": "Producción",
  "solicitante": "Solicitante de prueba",
  "correo_origen": "produccion@example.com",
  "prioridad": "media"
}
```

Producto, `POST sdi/{id}/items/`:

```json
{
  "articulo": "Pieza A-01",
  "descripcion": "Producto de prueba",
  "cantidad_indicada": 10,
  "cantidad_a_inspeccionar": 5,
  "codigo_plano": "PL-001"
}
```

El servidor establece `orden`. Asignación y revisión:

```json
{ "inspector": 2, "instrucciones": "Revisar acabado superficial." }
```

```json
{ "comentario": "Resultados revisados por gestión." }
```

Anulación y archivo/restauración:

```json
{ "motivo": "Solicitud registrada por error." }
```

```json
{ "archivar": true }
```

Usa `false` para restaurar. Estos ejemplos requieren IDs reales, rol adecuado y condiciones de negocio válidas; las direcciones `example.com` no configuran un correo operativo.

## Respuestas y errores

Creaciones habituales: 201; consultas/acciones: 200; retiro de producto: 204. Recepción deduplicada puede devolver 200. Una petición inválida puede devolver 400, autenticación fallida 401, acceso denegado 403, objeto no visible/inexistente 404 y método no permitido 405. La forma del error depende del endpoint y puede contener `detail`, campos o listas; no existe aquí un esquema único de errores declarado.

El detalle SDI integra productos, inspecciones, visual, evidencias, concesiones, documentos, historial y notificaciones. Descargar un archivo devuelve contenido binario. El cliente renueva el token tras 401 y repite una vez; una renovación fallida elimina la sesión conectada.
