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
- Creación y edición de actividades e inspecciones de muestra, con responsable, prioridad y observaciones.
- Vista de detalle que permite cambiar estados y agregar eventos al historial.
- Páginas navegables para panel, actividades, inspecciones, trazabilidad, equipo, ayuda y configuración.
- Invitación ficticia de integrantes con rol y estado de invitación.
- Exportación de los registros filtrados a CSV.
- Menú de sesión que cierra sesión y permite volver a entrar con cualquier contraseña de demostración.
- Preferencias de visualización y notificaciones.
- Diseño adaptable a escritorio y móvil, usando el azul institucional `#002B49`.

## Alcance de esta iteración

La interfaz funciona con datos locales de demostración y guarda cambios, sesión y preferencias en el almacenamiento local del navegador. No está conectada a una API ni a PostgreSQL, y el acceso no es autenticación real. Los nombres, cantidades y movimientos visibles sirven para previsualizar la experiencia y deben sustituirse por datos autorizados antes de usar el sistema con información real. El siguiente paso de integración es definir los endpoints de Django REST para actividades/inspecciones, usuarios, estados e historial.

La estructura visual y los campos reflejan el alcance preliminar del anteproyecto: usuarios y roles, actividades e inspecciones con responsable, fecha, prioridad, estado y observaciones, trazabilidad, panel y registro documental.
