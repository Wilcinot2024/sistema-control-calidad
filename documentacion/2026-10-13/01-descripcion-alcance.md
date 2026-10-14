# Descripción y alcance

Fecha: 13 de octubre de 2026. Estado: descripción de la implementación local.

## Propósito

Centralizar el seguimiento de solicitudes de inspección de productos, conservar sus documentos y registrar quién realiza cada etapa del control de calidad. La aplicación se presenta como sistema de control de calidad de Ancor Tecmin.

La necesidad abordada es disponer de un circuito trazable desde la recepción de una SDI hasta su cierre, con cantidades y resultados relacionados. La magnitud del problema, los tiempos anteriores y el ahorro obtenido deben medirse con la empresa; no hay una medición acreditada en estos documentos.

## Objetivos

- Registrar SDI manualmente o a partir de un PDF y conservar el original.
- Revisar datos y productos antes de asignar un inspector.
- Registrar inspección visual, cantidades, evidencias y resolución de pendientes.
- Exigir revisión de gestión antes del cierre.
- Consultar historial y controlar el acceso por rol y asignación.

## Alcance actual

| Componente | Comportamiento |
| --- | --- |
| Recepción | Captura manual o PDF; propuesta de lectura editable; recepción IMAP configurable |
| Gestión | Corrección previa, productos, prioridades e inspector activo |
| Inspección | Siete criterios visuales, cantidades, aprobación/rechazo y evidencias |
| Resolución | Reinspección y concesiones según reglas del backend |
| Cierre | Revisión explícita, validación de pendientes y aviso en cola |
| Conservación | Historial, anulación con motivo, archivo y restauración |
| Interfaz | Modo conectado y demostración independiente; tema claro/oscuro |

## Actores

Administrador, Jefe de Calidad y Supervisor conforman los roles de gestión. Inspector trabaja sus inspecciones y consulta las SDI asignadas. Producción/Bodega se representa mediante los datos de recepción. Ingeniería figura como responsable de una concesión; no existe un rol independiente de Ingeniería en el catálogo actual.

## Límites y dependencias

La lectura PDF usa texto seleccionable y requiere confirmación humana; no incluye OCR. El proveedor de correo no está definido. Algunas pantallas, gráficos, invitaciones y exportaciones pertenecen a la demostración; no se debe presentar toda la interfaz demo como funcionalidad conectada. No se acredita integración ERP, aplicación Android, firma electrónica ni despliegue productivo.

## Criterio de éxito propuesto

Un usuario de gestión recibe una SDI, corrige los datos, agrega productos y la asigna. El inspector registra resultados. Gestión resuelve pendientes, revisa y cierra. Cada etapa queda consultable con sus documentos, sin acceso de otro inspector y sin superar las cantidades autorizadas. Este criterio requiere ejecución y aceptación documentada.

Fuentes: README del backend/frontend, `quality/workflow.py`, `quality/services.py` y `OperationalApp.jsx`.
