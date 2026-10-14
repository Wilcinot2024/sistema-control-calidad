# Frontend — Control de Calidad Ancor Tecmin

Prototipo inicial de la interfaz de gestión y trazabilidad descrita en el anteproyecto. Está construido con React y Vite.

## Iniciar en desarrollo

```powershell
cd frontend
npm install
npm run dev
```

Vite imprimirá la dirección local para abrir en el navegador. Para generar una versión compilada: `npm run build`.

## Qué incluye

- Panel con resumen de actividades, estados y rendimiento semanal.
- Selector funcional entre esta semana, este mes y los últimos 7 días; cambian las barras y los indicadores del panel.
- Búsqueda y filtros por estado y área.
- Formularios separados para SDI, productos e inspecciones, con campos y validaciones básicas según los modelos del backend.
- Creación y edición local de esos registros, conservando los registros genéricos de demostración anteriores.
- Vista de detalle que permite cambiar estados y agregar eventos al historial.
- Páginas navegables para panel, actividades, inspecciones, trazabilidad, equipo, ayuda y configuración.
- Invitación ficticia de integrantes con rol y estado de invitación.
- Exportación de los registros filtrados a CSV.
- Menú de sesión que cierra sesión y permite volver a entrar con cualquier contraseña de demostración.
- Preferencias de visualización y notificaciones.
- Diseño adaptable a escritorio y móvil, usando el azul institucional `#002B49`.

## Modos disponibles

La cabecera ofrece **Sistema conectado** y **Ver demostración**. La demo conserva sus datos y formularios en localStorage. El modo conectado inicia sesión con JWT y utiliza exclusivamente la API: recepción PDF/manual, revisión y corrección, cantidades originales, productos, asignación, inspección visual, evidencias, reinspección/concesiones, revisión de resultados, cierre e historial.

`src/pages/OperationalApp.jsx` contiene el flujo conectado y `src/api/workflow.js` las peticiones autenticadas, renovación de tokens y descarga de archivos protegidos. Los tokens se guardan en sessionStorage; la contraseña no se almacena. Los permisos se validan de nuevo en el backend. El botón de luna/sol cambia el tema en ambos modos y conserva la preferencia local.

Consulta [la documentación del backend](../backend/README.md) para instalar dependencias, aplicar migraciones, crear usuarios y configurar correo. El proveedor aún no está definido; los avisos quedan en cola hasta configurar SMTP y ejecutar el proceso. No se simulan envíos exitosos.

## Organización de las páginas

`src/pages/DashboardPage.jsx` contiene la pantalla del Panel de control: bienvenida, indicadores, gráficos, actividades recientes y resumen de trazabilidad. También calcula los indicadores a partir de los registros y del periodo seleccionado, conservando los cálculos de demostración existentes.

`App.jsx` conserva la navegación, los registros, la sesión, el periodo, los filtros, el almacenamiento local y los modales. Cada página recibe los datos y las acciones mediante props; sus controles llaman a esas acciones sin duplicar el estado compartido. Los botones de registro y exportación permanecen en Actividades e Inspecciones; el panel muestra el resumen. Esto permite conservar los filtros al navegar y actualizar el panel al modificar registros.

| Archivo en `src/pages` | Responsabilidad |
| --- | --- |
| `DashboardPage.jsx` | Bienvenida, indicadores, gráficos, actividades recientes y trazabilidad resumida. |
| `ActivitiesPage.jsx` | Listado de actividades, filtros, exportación y acceso a formularios SDI/producto/inspección. |
| `InspectionsPage.jsx` | Listado de inspecciones, filtros, exportación y acceso al formulario de inspección. |
| `TraceabilityPage.jsx` | Historial demo, apertura del registro asociado y limpieza del historial local. |
| `TeamPage.jsx` | Integrantes e inicio de invitaciones de demostración. |
| `SettingsPage.jsx` | Preferencias, periodo del panel y restablecimiento de valores. |
| `HelpPage.jsx` | Guía rápida de la demostración. |
| `DemoLoginPage.jsx` | Formulario de acceso ficticio; la sesión se coordina desde App. |
| `OperationalApp.jsx` | Flujo conectado a la API con JWT y reglas del backend. |

`src/components/ActivityTable.jsx` comparte la tabla entre el panel, Actividades e Inspecciones; recibe la lista filtrada y el conjunto completo para resolver las vistas relacionadas con una SDI. `ActivityFilters.jsx` comparte los controles conservando su estado en App. `PageHeader.jsx` comparte las cabeceras de las páginas de listado y gestión; `Icon.jsx` mantiene los iconos comunes. Así se puede modificar una pantalla sin copiar la tabla, los filtros o los datos.

El selector **Periodo del panel** está en la cabecera, a la derecha del título y sobre Completadas, alineado con la cuarta columna de indicadores. Cambia las cifras y gráficos que ya dependen del periodo; **En proceso por entidad** conserva el estado actual de los registros. En móvil pasa debajo del texto para mantener la lectura y el acceso al selector.

Los iconos tienen descripciones al pasar el puntero; los controles de búsqueda, perfil, notificaciones y detalle también incluyen etiquetas accesibles. SDI utiliza un documento, Producto una caja e Inspección una lista de revisión, para representar sus distintas entidades.

La exportación CSV conserva los filtros de la lista y usa UTF-8 con BOM, separador explícito `sep=;` para Excel, encabezados y finales de fila CRLF. Distingue SDI, producto, proyecto, departamento solicitante, área del inspector y las cantidades originales, a inspeccionar, inspeccionadas y aprobadas. Los datos ausentes quedan vacíos; las fechas guardadas se presentan como `AAAA-MM-DD` y las referencias ficticias como «Hoy, 10:30» se conservan sin inventar fechas. Las comillas y los saltos de línea de las observaciones permanecen dentro de su celda. El CSV conserva datos, sin colores ni anchos de columna.

En el modo conectado, `src/pages/workflowAvailability.js` utiliza el rol activo, la asignación y las relaciones SDI → productos → inspecciones para presentar las acciones disponibles. Un inspector trabaja únicamente sus inspecciones en curso. La revisión requiere que todas hayan terminado; el cierre exige revisión vigente, productos resueltos y ausencia de concesiones pendientes. La pantalla explica los bloqueos y la API vuelve a validar cada acción; estas comprobaciones de interfaz no sustituyen los permisos del servidor.

La navegación sigue coordinada por `activeNav` en App; las pantallas se montan desde sus componentes independientes. No se incorporan rutas en esta etapa. Esta separación organiza las pantallas existentes: las páginas demo siguen usando datos locales y `OperationalApp` mantiene su flujo propio con la API.

La cabecera del panel muestra la fecha actual en español según `America/Santiago`; se actualiza cada minuto y al volver a la pestaña. El indicador **En proceso por entidad** cuenta SDI por `estado`, productos por `resultado_actual` e inspecciones por `resultado`, usando `en_proceso`. Hasta integrar los registros con la API, utiliza el estado de presentación local si falta el campo correspondiente. Los registros genéricos anteriores sin `formType` no se incluyen. Estos tres conteos corresponden al estado actual de todos los registros locales, independientemente del periodo elegido. Los demás indicadores y gráficos conservan sus cálculos de demostración.

El filtro de área obtiene sus opciones exclusivamente de `GET /api/areas/`, protegido con JWT y perfil activo, que devuelve áreas activas ordenadas por nombre. La sesión demo no contiene un token: el filtro muestra que hace falta una sesión real y mantiene **Todas las áreas**, sin generar opciones a partir de departamentos o textos locales. El hook está preparado para recibir `session.accessToken` al integrar la autenticación; el modo conectado incorpora acceso real con sus propios usuarios, sin reutilizar los IDs demo.

`Area` pertenece al perfil del inspector. Los serializers de SDI, producto e inspección ahora incluyen `area_inspector` de solo lectura: en producto corresponde al inspector de su SDI; en inspección, a su propio inspector. El filtro compara el ID de ese catálogo, nunca el departamento solicitante ni el nombre mostrado. Los registros demo sin esta relación siguen visibles en **Todas las áreas**, pero no se asignan a un área inventada.

En desarrollo, Vite reenvía `/api` al backend en `http://127.0.0.1:8000`. Se puede cambiar el destino con `API_PROXY_TARGET` en un archivo `.env.local`; para producción se necesita el reenvío equivalente en el servidor web. El flujo operativo requiere las migraciones 0004 y 0005 del backend. Las pruebas aisladas del catálogo se ejecutan con `python manage.py test quality --settings=config.test_settings` desde `backend`; usan SQLite en memoria y no acceden a PostgreSQL.

## Formularios de registro

Los componentes `SDIModal`, `ProductoModal` e `InspeccionModal` están en `src/components/QualityForms.jsx`. Cada uno recoge únicamente los campos de su entidad. El inspector se elige de un catálogo local de demostración, y los selectores de SDI y producto usan los registros creados con estos formularios.

Para probarlos: pulsa **Nueva SDI**, completa la solicitud y guárdala; pulsa **Agregar producto** y selecciona esa SDI; después pulsa **Iniciar inspección** y selecciona el producto. El guardado sigue siendo local y conserva los nombres de campos del backend dentro de `data`; la tabla existente utiliza datos adicionales de presentación. Los identificadores `localId` y los inspectores de demostración no son IDs reales del servidor.

En el formulario de SDI, código de proyecto y número de SDI filtran letras y signos al escribir o pegar, conservando los ceros iniciales. El código de proyecto acepta hasta seis dígitos. La fecha de emisión admite fechas válidas del año actual y el anterior, desde el 1 de enero del año anterior hasta hoy, calculado en `America/Santiago`; este límite de fecha es una regla adicional solicitada para el frontend y cambia automáticamente con el año. Todos sus campos incluyen una descripción al pasar el mouse sobre ellos.

Estos modales conservan el comportamiento de la demostración. En el modo conectado la SDI se registra pendiente, el inspector se elige únicamente al asignar y las acciones pasan por los servicios del backend.

En Producto, el artículo admite letras (incluidas tildes y ñ), números, espacios, puntos y guiones; los demás signos se bloquean al escribir y se filtran al pegar. El orden es de solo lectura y se calcula por SDI como el mayor orden registrado más uno, empezando en 1; al editar se conserva el orden existente. Todos los campos de Producto tienen una descripción al pasar el mouse.

Producto e Inspección comparten el control de cantidad con cuatro botones: −−, −, + y ++. Los símbolos simples cambian una unidad y los dobles, cinco; el texto al pasar el mouse indica el paso de cada botón. La cantidad empieza en 1, sin escritura directa ni ceros iniciales; las flechas arriba/abajo del teclado cambian una unidad. Los saltos se ajustan al límite si lo superarían (por ejemplo, 2 − 5 queda en 1). En Inspección, el máximo es la cantidad restante del producto y se reajusta al cambiar de producto; si no quedan unidades, el control y el guardado se deshabilitan. Antes de seleccionar un producto, también permanecen deshabilitados.

La estructura visual y los campos reflejan el alcance preliminar del anteproyecto: usuarios y roles, actividades e inspecciones con responsable, fecha, prioridad, estado y observaciones, trazabilidad, panel y registro documental.
