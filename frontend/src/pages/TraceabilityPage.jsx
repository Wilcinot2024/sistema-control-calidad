import React from 'react';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';

export default function TraceabilityPage({ audit, onClear, onOpenRecord }) {
  return <>
    <PageHeader
      eyebrow="REGISTRO DE CAMBIOS"
      title="Trazabilidad"
      description="Consulta quién realizó cada cambio y qué registro estuvo involucrado. Aquí se reúnen las creaciones, modificaciones, retiradas, anulaciones y movimientos de archivo de esta demostración, para seguir la historia de las actividades guardadas en este navegador."
      actions={<button className="button button-outline" onClick={onClear}><Icon name="history" size={16}/> Limpiar historial demo</button>}
    />
    <div className="card audit-page">
      {audit.length ? audit.map(entry => <div className="audit-row" key={entry.id}>
        <div className={`avatar avatar-small ${entry.color}`}>{entry.initials}</div>
        <div>
          <strong>{entry.actor}</strong>
          <span>{entry.action} <button onClick={() => onOpenRecord(entry.itemId)}>{entry.itemId}</button></span>
          <small>{entry.time}</small>
        </div>
        <span className="timeline-icon">{entry.icon}</span>
      </div>) : <div className="empty-state">Aún no hay movimientos. Crea una actividad o actualiza un estado para ver eventos aquí.</div>}
    </div>
  </>;
}
