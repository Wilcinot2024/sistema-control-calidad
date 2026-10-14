import React from 'react';
import PageHeader from '../components/PageHeader';

export default function HelpPage() {
  return <>
    <PageHeader
      eyebrow="GUÍA RÁPIDA"
      title="Ayuda"
      description="Encuentra una guía para crear solicitudes SDI, agregar productos y probar inspecciones. También puedes revisar cómo funcionan los filtros, el historial y las acciones disponibles en esta demostración local."
    />
    <div className="card help-page">
      <h2>Comienza por el panel</h2>
      <p>Usa Periodo del panel, junto al título, para cambiar los indicadores y gráficos entre semana, mes y últimos 7 días. En proceso por entidad muestra el estado actual. Crea una SDI, agrega sus productos e inicia una inspección mediante sus formularios separados.</p>
      <h2>Gestiona los registros</h2>
      <p>En Actividades o Inspecciones puedes buscar, filtrar por estado o área, abrir el detalle, cambiar el estado y guardar observaciones. Exportar CSV descarga los resultados filtrados.</p>
      <h2>Sesión de demostración</h2>
      <p>Abre el menú de tu perfil para cerrar sesión. En la pantalla de acceso puedes iniciar otra sesión ficticia con cualquier contraseña.</p>
      <div className="demo-notice">Los cambios se guardan en el almacenamiento local de este navegador; no se envían a un servidor.</div>
    </div>
  </>;
}
