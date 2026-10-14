# Requisitos y matriz de trazabilidad

Fecha: 13 de octubre de 2026. Requisitos derivados de la implementación; su aprobación formal está pendiente. «Implementado» indica presencia en código, sin certificar aceptación empresarial.

## Requisitos funcionales

| ID | Requisito / aceptación esperada | Fuente principal | Estado |
| --- | --- | --- | --- |
| RF-01 | Autenticar con JWT y exigir usuario/perfil activos para operar | permissions.py, config/urls.py | Implementado |
| RF-02 | Gestión registra SDI pendiente sin asignación automática | workflow_api.sdis | Implementado |
| RF-03 | Recibir PDF, guardar original y propuesta; evitar duplicados | workflow.receive_pdf, pdf_intake.py | Implementado |
| RF-04 | Corregir datos y productos únicamente antes de asignar | workflow_api.sdi_detail, product_detail | Implementado |
| RF-05 | Asignar solo con datos revisados, productos e inspector activo | workflow.assign_sdi | Implementado |
| RF-06 | Inspector ve sus SDI y trabaja sus propias inspecciones | visible_sdis, validar_acceso_inspeccion | Implementado |
| RF-07 | Registrar siete criterios visuales y cantidades válidas | models.py, services.py, views.py | Implementado |
| RF-08 | Adjuntar evidencias y descargarlas con autorización | workflow_api.upload_evidence, evidence_file | Implementado |
| RF-09 | Gestionar reinspecciones y concesiones para pendientes | services.py, views.py | Implementado |
| RF-10 | Exigir revisión vigente y ausencia de pendientes para cerrar | workflow.review_results, services.py | Implementado |
| RF-11 | Conservar historial con usuario, fecha y acción | HistorialSDI, record_event | Implementado |
| RF-12 | Anular solo SDI pendiente sin asignación/inspecciones y con motivo | workflow.annul_sdi | Implementado |
| RF-13 | Archivar/restaurar conservando estado y acceso | workflow.archive_sdi | Implementado |
| RF-14 | Contar SDI, productos e inspecciones por separado | workflow_api.dashboard | Implementado |
| RF-15 | Recibir por IMAP y procesar avisos SMTP con reintentos | mail.py, process_sdi_mail.py | Código disponible; proveedor pendiente |
| RF-16 | Exportar registros filtrados a CSV | pages/csvExport.js | Disponible en demostración |

## Reglas de negocio

| ID | Regla |
| --- | --- |
| RN-01 | Proyecto: 1 a 6 dígitos; número SDI: solo dígitos; conservar ceros iniciales |
| RN-02 | Fecha de emisión: desde el 1 de enero del año anterior hasta hoy en Santiago |
| RN-03 | Orden de producto: máximo orden de su SDI más uno; no editable |
| RN-04 | Cantidad indicada: positiva y opcional; cantidad a inspeccionar: al menos uno y no superior a indicada si existe |
| RN-05 | Cantidad aprobada entre cero e inspeccionada; las liberaciones no superan el alcance del producto |
| RN-06 | Un cambio de resultados invalida la revisión previa |
| RN-07 | Anular no libera el código; restaurar una anulada no la reactiva |
| RN-08 | Retirar producto requiere SDI pendiente sin asignación y producto sin inspecciones; conserva descripción en historial |

Los resultados de SDI, producto e inspección son campos distintos. `parcial` pertenece al resultado de inspección; no aparece entre las opciones declaradas de `ItemSDI.Resultado`.

## Requisitos no funcionales y validación pendiente

| ID | Condición | Evidencia o pendiente |
| --- | --- | --- |
| RNF-01 | Autorización validada en servidor | Permisos y pruebas de acceso; ampliar aceptación por rol |
| RNF-02 | Transacciones para cambios de dominio | Servicios con atomic/bloqueos; validar concurrencia en PostgreSQL |
| RNF-03 | Archivos con límites de procesamiento | PDF hasta 20 MB/100 páginas; evidencias hasta 20 MB |
| RNF-04 | Interfaz adaptable y etiquetas accesibles | CSS/componentes; pendiente evaluación con usuarios |
| RNF-05 | Instalación reproducible | Manifiestos y comandos; dependencias por rangos, no todas fijadas |
| RNF-06 | Respaldo recuperable | Procedimiento propuesto; restauración completa pendiente |
| RNF-07 | Rendimiento adecuado al volumen real | No existe umbral aprobado ni prueba de carga acreditada |

La relación con casos de aceptación está en el [plan de pruebas](08-plan-pruebas.md). No se fijan cifras de disponibilidad o tiempos de respuesta sin acuerdo y medición.
