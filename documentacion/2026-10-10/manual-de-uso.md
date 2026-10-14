# Manual de uso

Sistema de Control de Calidad Ancor · Guía de Jefe/Supervisor e Inspector

**Versión 1.0 · 10 de octubre de 2026 · America/Santiago**

## 1 Acceso y elección del modo

El sistema agrupa solicitudes SDI, sus productos, inspecciones y documentación. El recorrido operativo es: recibir → revisar datos y cantidades → asignar → inspeccionar → revisar resultados → cerrar.

| Modo | Qué permite y dónde guarda |
| --- | --- |
| Demostración | Presenta el panel y sus apartados con registros locales. Guarda en este navegador; no modifica el backend ni envía correos. |
| Sistema conectado | Trabaja con SDI de la API y permisos reales. Tiene su propia lista y detalle; requiere usuario y contraseña creados en el backend. |

### Entrar al sistema conectado

1. Abre http://127.0.0.1:5173 cuando los servicios locales estén iniciados.
2. Pulsa **Sistema conectado** en la cabecera.
3. Introduce **Usuario** y **Contraseña** facilitados por quien administra el backend. Pulsa **Ingresar**.
4. Comprueba tu nombre y rol. Jefe/Supervisor puede gestionar solicitudes; Inspector verá las que se le asignen.

Actualmente no hay cuentas en la base local. Si aún no te han creado una, usa Ver demostración; una contraseña ficticia de la demo no da acceso real.

### Apartados de la demostración

| Apartado | Para qué sirve |
| --- | --- |
| Panel de control | Resumen e indicadores. Algunos valores por periodo son de ejemplo. |
| Actividades | Consultar, buscar y registrar SDI/productos; exportar CSV. |
| Inspecciones | Listado y registro de inspecciones demo. |
| Trazabilidad | Eventos guardados localmente. |
| Equipo | Miembros e invitaciones de demostración. |
| Configuración y Ayuda | Preferencias e información del prototipo. |

Los pasos 2 a 6 de este manual se refieren al sistema conectado. El apartado 7 explica las funciones de demostración. Cambiar de modo no copia los registros.

## 2 Recibir y revisar una SDI

### Responsable de esta etapa

Administrador, Jefe de Calidad o Supervisor. El Inspector no ve una SDI pendiente sin asignar.

1. En **Solicitudes SDI**, abre **Recibir una SDI**.
2. Selecciona un PDF de hasta 20 MB e introduce Correo de origen si lo conoces. Pulsa **Recibir PDF**. Para registrar sin PDF, usa **Crear SDI manual**.
3. Selecciona la solicitud. Usa **Ver PDF** o **Descargar PDF** para contrastar el original.
4. En **Revisar datos de recepción**, revisa los valores propuestos y completa los obligatorios.
5. Revisa el correo de Producción/Bodega, prioridad y observaciones. Pulsa **Confirmar datos**.

| Dato | Qué introducir |
| --- | --- |
| Activación proyecto | Código de 1 a 6 dígitos; admite ceros iniciales. |
| Número SDI | Únicamente dígitos. No escribas letras ni signos. |
| Fecha de emisión | Fecha válida del año actual o anterior, sin superar hoy. En esta edición: 2025-01-01 a 2026-10-10. |
| Proyecto | Nombre del proyecto, hasta 200 caracteres. |
| Departamento solicitante | Departamento de Producción/Bodega que solicita; hasta 150. No es el área del inspector. |
| Solicitante | Nombre de quien solicita; hasta 150. |
| Correo Producción/Bodega | Dirección que recibirá avisos cuando el correo esté configurado. |
| Prefijo BOD y prioridad | Marca BOD cuando corresponda; elige baja, media o alta. |

La propuesta del PDF es una ayuda y no reemplaza la revisión. Si el documento está escaneado o sus datos no se reconocen, complétalos manualmente. No se realiza OCR. Se conserva el original y la propuesta para trazabilidad.

La recepción por correo será automática cuando el administrador configure buzón y proceso IMAP. Por ahora el proveedor está pendiente. La recepción manual por PDF sí está implementada.

## 3 Productos, cantidades y asignación

### Revisar cada producto

1. Abre **Productos propuestos por el PDF** si aparecen y pulsa **Revisar y agregar**, o usa **Agregar producto**.
2. Revisa el Artículo, Descripción, Cantidad indicada, Cantidad a inspeccionar, Código de plano y Observaciones.
3. Pulsa **Guardar producto** y repite para cada producto de la solicitud.

Artículo admite letras, números, espacios, puntos y guiones; máximo 250 caracteres. Orden es automático y no editable. En un producto nuevo conectado puede quedar sin número hasta que el servidor lo guarde; al editar conserva el orden.

| Cantidad | Significado |
| --- | --- |
| Indicada | Cantidad recibida de Producción/Bodega. Opcional si aún no se conoce; si se informa, debe ser un entero positivo. |
| A inspeccionar | Cantidad que Jefe/Supervisor decide revisar. Mínimo 1; no puede superar la indicada si existe. |
| Inspeccionada | Cantidad de la revisión concreta que se genera al asignar o reinspeccionar. |
| Aprobada | Unidades conformes después de la revisión. Puede ser 0. |

Los botones **--** y **++** restan/suman 5; **-** y **+** restan/suman 1. No escribes directamente en Cantidad a inspeccionar. Las flechas del teclado cambian 1. Los saltos se ajustan al límite: si tienes 2 y restas 5, queda 1.

### Asignar al Inspector

1. Comprueba que la SDI tiene datos confirmados y al menos un producto con su alcance de inspección.
2. En **Asignar SDI**, selecciona un Inspector activo.
3. Escribe las instrucciones que deben acompañar a todos los productos. Las observaciones de producto aportan indicaciones particulares.
4. Pulsa **Asignar e iniciar inspecciones**.

La SDI pasa a En proceso y se crea una inspección inicial por producto. Desde ese momento la ve el Inspector asignado. La asignación, cantidades y responsable quedan en historial; el aviso de SDI en proceso queda en cola para su envío.

No uses la demo para asignar trabajo real. En el modo conectado no tienes que iniciar manualmente cada inspección inicial.

## 4 Trabajo del Inspector

1. Entra al **Sistema conectado** con tu usuario de Inspector.
2. Selecciona una SDI asignada. Si no aparece, usa **Actualizar** y comprueba los filtros; después consulta al Jefe/Supervisor si todavía no te fue asignada.
3. Consulta el PDF y los productos. Lee las cantidades e indicaciones de cada inspección.
4. Antes de finalizar, carga las evidencias necesarias en **Adjuntar evidencia**: archivo de hasta 20 MB, tipo y descripción.
5. Completa todos los criterios visuales. Elige Conforme, No conforme o No aplica en cada uno.
6. Indica las unidades aprobadas y pulsa **Finalizar inspección**. Repite con los otros productos.

| Criterio visual | Qué se registra |
| --- | --- |
| Rebarbas | Conforme / No conforme / No aplica. |
| Rayaduras | Conforme / No conforme / No aplica. |
| Golpes | Conforme / No conforme / No aplica. |
| Deformidad | Conforme / No conforme / No aplica. |
| Pintura | Conforme / No conforme / No aplica. |
| Burbujas | Conforme / No conforme / No aplica. |
| Planitud | Conforme / No conforme / No aplica. |

### Cómo se determina el resultado

Cantidad aprobada no puede superar la inspeccionada. Si apruebas 0, la inspección queda rechazada; si apruebas solo una parte, queda parcial. Aprobar todas exige una revisión visual conforme. El sistema recalcula el resultado del producto y de la SDI.

Ejemplo: se inspeccionan 10 unidades y se aprueban 7. El resultado es parcial y quedan 3 unidades por resolver. No se pueden volver a liberar las 7 ya aprobadas.

Las evidencias deben adjuntarse mientras la inspección está en curso. Solo el Inspector asignado y los roles autorizados de gestión pueden trabajarla. Si una acción está bloqueada, revisa el mensaje antes de intentar modificar otros registros.

## 5 Resolver pendientes, revisar y cerrar

### Reinspección y concesión

Jefe/Supervisor decide cómo resolver unidades pendientes. Reinspeccionar requiere que la última inspección sea rechazada o parcial, queden unidades sin liberar y no haya otra inspección en curso. La nueva cantidad no supera las restantes y conserva el inspector de la SDI.

1. Si corresponde una nueva revisión, usa **Crear reinspección**, indica cantidad e instrucciones.
2. Si corresponde solicitar concesión, completa **Responsable de ingeniería** y **Justificación**; pulsa **Registrar solicitud**.
3. Revisa la solicitud y resuélvela con **Aprobar concesión** o **Rechazar concesión**, según tus permisos y la decisión autorizada.

Hoy estas acciones de concesión las realizan los roles de gestión en la aplicación. El nombre del responsable de Ingeniería queda registrado, pero no existe una cuenta o paso separado de aprobación por Ingeniería. Coordina esa decisión según el proceso de la empresa.

### Revisión de resultados

1. Cuando el Inspector termine todas las inspecciones, abre la SDI y revisa resultados, cantidades, documentos y evidencias.
2. En **Revisión de Jefe / Supervisor**, escribe el comentario pertinente.
3. Pulsa **Confirmar revisión de resultados**.

Si aún hay una inspección en curso, el sistema explica el bloqueo. Revisar no cierra automáticamente: confirma que Jefe/Supervisor comprobó el resultado. Si se cambian resultados después, se invalida la revisión y hay que repetirla.

### Cierre

1. Comprueba que todos los productos están resueltos: aprobados, rechazados o en concesión resuelta.
2. Verifica que no quedan inspecciones en curso ni concesiones pendientes y que la revisión sigue vigente.
3. Pulsa **Cerrar SDI** cuando esté habilitado.

La solicitud queda Cerrada, conserva el resultado de cierre y actualiza el historial. Se registra un aviso para Producción/Bodega. Cerrada no significa necesariamente aprobada: consulta el resultado final.

Mientras SMTP no esté configurado, el aviso queda pendiente. Una notificación enviada significa aceptación del servidor de correo, no lectura por el destinatario.

## 6 Retirar, anular y archivar

| Acción | Cuándo y qué ocurre |
| --- | --- |
| Retirar producto | Solo gestión; SDI pendiente sin asignar, producto sin inspecciones. Corrige una incorporación por error y guarda descripción en el historial. |
| Anular SDI | Solo gestión; pendiente, sin asignación ni inspecciones. Exige motivo de 1 a 1000 caracteres; conserva solicitud, código, PDF y trazabilidad. |
| Archivar SDI | Solo gestión; solicitud no pendiente. La SDI y sus productos/inspecciones salen de la vista habitual, manteniendo su estado. |
| Restaurar SDI | Desde Archivadas. Vuelve a la vista de su estado anterior; una anulada continúa anulada. |

### Anular una solicitud por error

1. Abre la SDI pendiente y pulsa **Anular SDI**.
2. Lee la confirmación y escribe un motivo concreto.
3. Confirma la acción. Si dejas el motivo vacío o solo con espacios, verás un aviso y el campo recibirá el foco.

La anulación no se revierte y el código sigue reservado. No se permite reasignar una SDI anulada. Para consultar lo conservado, cambia a la vista Anuladas o Todas.

### Archivar y consultar

1. Abre una SDI que ya no esté pendiente y pulsa **Archivar SDI**.
2. Para encontrarla después, selecciona **Archivadas** en Vista.
3. Si necesitas recuperarla en el listado habitual, abre el detalle y pulsa **Restaurar SDI**.

Archivar no elimina ni finaliza el trabajo. El estado operativo se mantiene; incluso una SDI en proceso puede archivarse. En el modo conectado el archivo no bloquea por sí solo sus acciones operativas. En la demo, el detalle archivado se restaura antes de editar.

Activas excluye anuladas y archivadas; Anuladas muestra las anuladas sin archivar; Archivadas reúne las archivadas; Todas permite consultar el conjunto autorizado. Los permisos del Inspector siguen aplicándose en todas las vistas.

No existe borrado libre de SDI o inspecciones. La demo también tiene Productos retirados y archivo de registros locales individuales; el modo conectado archiva la SDI completa.

## 7 Demo, exportación y ayuda

### Crear registros y filtrar en la demo

En Actividades usa Nueva SDI y después Agregar producto seleccionando esa solicitud. En Inspecciones usa Iniciar inspección y elige el producto. Es un ensayo local; no genera documentos, asignación ni permisos reales del servidor.

Búsqueda encuentra identificador, título y responsable. Los estados de presentación son Todas, Pendiente, En proceso y Completada. Vista está junto a los filtros de Actividades e Inspecciones; el filtro de área necesita catálogo real y no está en el panel principal.

El panel sirve como resumen. Los controles de registro y exportación están en sus apartados. Al cambiar el periodo, gráficos y cifras pasan suavemente al valor nuevo; parte del rendimiento sigue siendo ficticio.

### Exportar un CSV ordenado

1. Abre Actividades o Inspecciones y aplica los filtros deseados.
2. Pulsa **Exportar CSV**. Se descarga todo el listado filtrado, aunque en otro resumen solo se vean algunos registros.
3. Abre el archivo en tu hoja de cálculo. Si queda en una columna, impórtalo como UTF-8 y elige punto y coma como separador.

La exportación diferencia SDI, producto, proyecto, departamento, área del inspector y cantidades. Incluye encabezados y 19 columnas; conserva tildes, comillas y observaciones con saltos. Fechas guardadas usan AAAA-MM-DD; los valores ficticios se conservan como referencia. Un campo vacío significa que ese dato no está disponible.

CSV conserva datos y columnas; no guarda colores, bordes ni anchos. Esta exportación está en la demo, no en la pantalla conectada.

### Tema y ayudas

Usa el botón de luna/sol de la cabecera para cambiar entre tema claro y oscuro. La preferencia se recuerda en este navegador. El oscuro utiliza negros y grises. Mantén el puntero sobre iconos y campos para leer sus descripciones; los botones simples de cantidad cambian 1 y los dobles 5.

| Si ocurre esto | Qué revisar |
| --- | --- |
| No entra con usuario/contraseña | Cuenta del backend, contraseña correcta y perfil activo; no uses credenciales ficticias. |
| No aparece una SDI al Inspector | Asignación a tu usuario, vista elegida y filtro de área. |
| No permite asignar o cerrar | Lee el mensaje: datos pendientes, productos, revisión o concesiones sin resolver. |
| No llega el correo | Consulta si SMTP y el proceso de correo ya están configurados. |
| No se carga el sistema | Servicios frontend/backend iniciados y dirección/puertos correctos. |

Los datos demo pertenecen al navegador. Limpiar su almacenamiento puede perderlos. Cerrar sesión en el modo conectado elimina los tokens locales, sin borrar las SDI del backend.
