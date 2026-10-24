# Manual de usuario

## Acceso y modos

Abre la aplicación y selecciona **Sistema conectado**. Ingresa con el usuario operativo creado para tu rol. La demostración tiene datos propios del navegador; sus invitaciones y cambios no crean usuarios ni registros en la API.

Administrador, Jefe de Calidad y Supervisor gestionan SDI. Inspector consulta las asignadas y trabaja sus propias inspecciones. Si falta una acción, revisa rol, asignación y etapa; el servidor también valida estas condiciones.

## Gestión: recibir y asignar

1. Registra una SDI manual o carga su PDF indicando el correo de origen.
2. Abre la recepción pendiente. Contrasta la propuesta con el documento original.
3. Completa código, fecha, proyecto, departamento y solicitante. Conserva los ceros del código.
4. Revisa los productos, plano y cantidades. Cantidad indicada representa lo recibido; cantidad a inspeccionar define el alcance autorizado.
5. Corrige o retira productos agregados por error antes de asignar. El retiro conserva una descripción en historial y no tiene una restauración de producto documentada.
6. Selecciona un inspector activo e instrucciones y confirma la asignación.

La asignación genera una inspección inicial por producto y un aviso en cola. Que exista el aviso no acredita entrega por correo.

## Inspector: registrar una inspección

1. Abre una SDI asignada y selecciona el producto/inspección en curso.
2. Comprueba las cantidades autorizadas.
3. Completa rebarbas, rayaduras, golpes, deformidad, pintura, burbujas y planitud. Cada criterio admite conforme, no conforme o no aplica.
4. Adjunta evidencias antes de finalizar y escribe observaciones pertinentes.
5. Registra las unidades aprobadas entre cero y la cantidad inspeccionada y finaliza con la acción correspondiente.

Cero aprobadas produce rechazo; una parte produce resultado parcial; la totalidad requiere conformidad visual. Si existen pendientes, utiliza el circuito autorizado de reinspección o concesión. No aumentes cantidades para eludir un bloqueo.

## Gestión: resolver, revisar y cerrar

Comprueba resultados y pendientes por producto. Para concesión registra responsable de Ingeniería y justificación y resuelve conforme a la autorización de la empresa. No hay una sesión de Ingeniería independiente en el catálogo actual.

Cuando todas las inspecciones hayan terminado, registra la revisión de resultados. El cierre exige revisión vigente, productos resueltos y ninguna concesión pendiente. Si cambia un resultado, vuelve a revisar. Consulta `resultado_cierre`: una SDI cerrada no significa por sí sola que toda la producción quedó aprobada.

## Anular y archivar

Anula una recepción errónea solo cuando esté pendiente, sin asignación ni inspecciones. Escribe un motivo; se conserva código, documentos e historial. La anulación es definitiva.

Archivar oculta una SDI elegible de listados y contadores habituales, sin modificar su resultado. Consulta las vistas anuladas/archivadas/todas para encontrarla. Restaurar la devuelve a la visibilidad correspondiente; una anulada sigue anulada. Una recepción pendiente debe revisarse o anularse antes de archivarla.

## Problemas frecuentes

| Situación | Qué revisar |
| --- | --- |
| No puedo entrar | Credenciales, modo conectado, usuario y perfil activos, API disponible |
| No veo una SDI | Inspector asignado, rol y vista activa/archivada/anulada |
| No puedo asignar | Datos obligatorios, fecha, productos, cantidades y estado del inspector |
| PDF sin datos | Puede ser escaneado; completar manualmente, no hay OCR |
| No puedo cerrar | Inspecciones en curso, pendientes, concesiones o revisión invalidada |
| Aviso sin enviar | Configuración SMTP, proceso de correo e intentos/error de notificación |
| No aparece CSV conectado | La exportación descrita pertenece a la demostración |

No modifiques la base de datos directamente para saltar bloqueos. Comunica a mantenimiento el código SDI, acción, fecha y mensaje de error, sin incluir contraseñas ni tokens.
