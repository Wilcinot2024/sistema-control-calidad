# Documentación del proyecto

Edición: **13 de octubre de 2026**. Referencia: código local del repositorio, incluidos los cambios sin confirmar presentes al preparar estos archivos. Los documentos son editables en Markdown.

## Archivos incluidos y para qué sirven

| Archivo | Uso | Destinatario |
| --- | --- | --- |
| [01 — Descripción y alcance](01-descripcion-alcance.md) | Problema, objetivos, funciones y límites | Empresa, docente, equipo |
| [02 — Requisitos y trazabilidad](02-requisitos-trazabilidad.md) | Requisitos con identificadores, fuente y aceptación | Desarrollo y evaluación |
| [03 — Arquitectura](03-arquitectura.md) | Componentes, relaciones y decisiones actuales | Desarrollo |
| [04 — Base de datos](04-base-datos.md) | Entidades, campos, restricciones y diagrama | Desarrollo y mantenimiento |
| [05 — Instalación y configuración](05-instalacion-configuracion.md) | Arranque local, PostgreSQL y variables | Quien instala |
| [06 — API](06-api.md) | Rutas, métodos, autenticación y ejemplos | Integración |
| [07 — Manual de usuario](07-manual-usuario.md) | Procedimientos por rol y problemas frecuentes | Jefatura, supervisor, inspector |
| [08 — Plan de pruebas](08-plan-pruebas.md) | Comandos, casos y registro de resultados | QA y evaluación |
| [09 — Seguridad y datos](09-seguridad-datos.md) | Acceso, archivos, secretos y decisiones pendientes | Administración |
| [10 — Despliegue y mantenimiento](10-despliegue-mantenimiento.md) | Preparación, respaldos, restauración y diagnóstico | Operación |
| [11 — Gestión y pendientes](11-gestion-pendientes.md) | Riesgos, hitos y control de cambios | Responsable del proyecto |
| [12 — Informe de entrega](12-informe-entrega.md) | Base editable para informe académico o empresarial | Empresa y docente |
| [13 — Acta de aceptación](13-acta-aceptacion.md) | Plantilla de revisión, observaciones y conformidad | Responsables de aceptación |

## Orden de lectura

Para entender el proyecto: 01, 02 y 03. Para ejecutarlo: 05 y 07. Para mantenerlo: 04, 06, 08, 09 y 10. Para presentarlo o entregarlo: 11, 12 y 13.

Los archivos 12 y 13 son **plantillas pendientes de completar y validar**. No declaran una entrega aceptada. Los requisitos documentan el comportamiento observado en código; no equivalen a requisitos formalmente aprobados por la empresa.

## Documentos que ya existían

- [Manual técnico y manual de uso, edición del 10 de octubre](../2026-10-10/LEEME.md), con PDF y fuentes editables.
- [README backend](../../backend/README.md) y [README frontend](../../frontend/README.md).
- [Anteproyecto recibido](../../Anteproyecto_Practica_CITT_DuocUC_REVISION_2.docx).
- [Retroalimentación recibida](../../Retroalimentacion_Grupo1%20-%20copia.pdf).

El anteproyecto y la retroalimentación se mantienen como documentos de entrada. En esta edición no se revisó su contenido interno ni se asegura cumplimiento de una rúbrica académica específica.

## Estado y actualización

Existe un flujo conectado de recepción, asignación, inspección, revisión y cierre. La demostración tiene funciones locales adicionales. Faltan validación con la empresa, proveedor de correo, pruebas en PostgreSQL y preparación del despliegue. No hay evidencia de aceptación final en este paquete.

Al cambiar una función, actualiza requisito, contrato API, manual y caso de prueba asociado. Para una entrega formal registra versión o commit, responsable y evidencias. Mantén las ediciones anteriores como historial.
