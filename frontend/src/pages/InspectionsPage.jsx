import React from 'react';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import ActivityFilters from '../components/ActivityFilters';
import ActivityTable from '../components/ActivityTable';

export default function InspectionsPage({ items, allItems, filters, onSelect, onExport, onCreate }) {
  return <>
    <PageHeader
      eyebrow="GESTIÓN OPERATIVA"
      title="Inspecciones"
      description="Consulta las inspecciones de Control de Calidad, sus productos y responsables. Inicia una inspección, revisa las unidades a inspeccionar y sigue sus estados y observaciones; también puedes consultar los registros archivados y exportar la lista filtrada."
      actions={<div className="welcome-actions registration-actions">
        <button className="button button-outline" onClick={onExport}><Icon name="download" size={17}/> Exportar CSV</button>
        <button className="button button-primary" onClick={() => onCreate('Inspección')}><Icon name="plus" size={18}/> Iniciar inspección</button>
      </div>}
    />
    <div className="card activity-card full-list-card">
      <ActivityFilters {...filters}/>
      <ActivityTable items={items} allItems={allItems} onSelect={onSelect}/>
    </div>
  </>;
}
