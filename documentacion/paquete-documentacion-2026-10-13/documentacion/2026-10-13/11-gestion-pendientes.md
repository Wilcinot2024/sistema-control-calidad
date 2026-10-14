# Gestión del proyecto, riesgos y pendientes

Fecha: 13 de octubre de 2026. No se asignan fechas, autores ni aprobaciones que no estén acreditados.

## Situación de la entrega

El repositorio contiene flujo conectado, demostración, pruebas automatizadas y manuales anteriores. Hay cambios locales sin confirmar: esta documentación describe esa copia de trabajo y no identifica una versión publicada. Para la entrega formal se debe fijar commit/versión y registrar evidencias.

## Pendientes priorizados

| Prioridad | Trabajo | Criterio para completarlo |
| --- | --- | --- |
| Alta | Validación del circuito por empresa y roles | Casos críticos ejecutados y acta con observaciones |
| Alta | Muestras reales de SDI | Extracción revisada y límites conocidos por formato |
| Alta | Proveedor y permisos de correo | Recepción/envío autorizados, reintentos comprobados |
| Alta | Entorno PostgreSQL | Migraciones, integridad y concurrencia probadas |
| Alta | Despliegue y recuperación | Infraestructura configurada y respaldo restaurado |
| Media | Circuito de Ingeniería | Responsables y autorización de concesiones acordados |
| Media | Pantallas/métricas demo pendientes de conexión | Definir alcance y conectar las aprobadas |
| Media | Evidencia y versiones reproducibles | Versiones registradas, logs y revisión de dependencias |
| Media | Revisión académica | Contrastar informe con anteproyecto, retroalimentación y rúbrica |

## Riesgos

| Riesgo | Efecto | Tratamiento propuesto |
| --- | --- | --- |
| Confundir demo y conectado | Presentar datos ficticios como operativos | Identificar modo y usar registros de API en aceptación |
| Formatos PDF variables/escaneados | Extracción incompleta | Validación humana y muestras; evaluar OCR solo si se solicita |
| Correo sin configuración | Avisos pendientes | Proveedor autorizado, supervisión y control de errores |
| Pruebas solo SQLite | Diferencias en operación real | Pruebas específicas en PostgreSQL |
| Respaldo incompleto | Pérdida de documentos o trazabilidad | Base y media consistentes, restauración ensayada |
| Dependencias por rangos | Instalaciones diferentes | Registrar versiones y definir estrategia de fijación |

## Hitos sugeridos sin fecha comprometida

1. Confirmación de requisitos y formatos de entrada.
2. Validación del flujo y resolución de defectos críticos.
3. Configuración de correo y entorno de preproducción.
4. Prueba de recuperación y aceptación por usuarios.
5. Entrega de código, documentación y acta.

Responsables, duración, presupuesto y calendario quedan por acordar. No se deducen horas de trabajo a partir de la fecha de un archivo.

## Control de cambios

| Fecha | Cambio | Responsable | Versión/evidencia |
| --- | --- | --- | --- |
| 2026-10-10 | Manuales de uso/técnico y resumen existentes | Consultar antecedentes del proyecto | documentacion/2026-10-10 |
| 2026-10-13 | Paquete documental de alcance, requisitos, diseño, operación y entrega | Preparación asistida; revisión humana pendiente | Copia local, sin commit de entrega fijado |

Para nuevos cambios registra solicitud, motivo, impacto en datos/permisos, archivos, verificación y documentación actualizada.
