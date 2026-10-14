import React from 'react';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import ActivityFilters from '../components/ActivityFilters';
import ActivityTable from '../components/ActivityTable';

export default function ActivitiesPage({ items, allItems, filters, onSelect, onExport, onCreate }) {
  return <>
    <PageHeader
      eyebrow="GESTIÓN OPERATIVA"
      title="Actividades"
      description="Organiza las solicitudes SDI, sus productos y las actividades del equipo. Busca y filtra registros, consulta el detalle y revisa las vistas de activos, anulados o archivados; las acciones disponibles dependen de tu rol y del estado de cada registro."
      actions={<div className="welcome-actions registration-actions">
        <button className="button button-outline" onClick={onExport}><Icon name="download" size={17}/> Exportar CSV</button>
        <button className="button button-primary" onClick={() => onCreate('SDI')}><Icon name="plus" size={18}/> Nueva SDI</button>
        <button className="button button-outline" onClick={() => onCreate('Producto')}>Agregar producto</button>
        <button className="button button-outline" onClick={() => onCreate('Inspección')}>Iniciar inspección</button>
      </div>}
    />
    <div className="card activity-card full-list-card">
      <ActivityFilters {...filters}/>
      <ActivityTable items={items} allItems={allItems} onSelect={onSelect}/>
    </div>
  </>;
}
