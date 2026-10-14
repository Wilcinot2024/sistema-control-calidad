import React from 'react';
import Icon from './Icon';
import { recordView } from '../pages/recordLifecycle';

const recordIcons = { SDI: 'sdi', Producto: 'product', Inspección: 'check' };
const viewLabels = { anuladas: 'SDI anulada', archivadas: 'Archivado', retiradas: 'Retirado' };

export default function ActivityTable({ items, allItems, onSelect, limit = Infinity }) {
  return <div className="table-scroll">
    <table>
      <thead><tr><th>ACTIVIDAD</th><th>RESPONSABLE</th><th>PRIORIDAD</th><th>ESTADO</th><th>FECHA</th><th/></tr></thead>
      <tbody>{items.slice(0, limit).map(item => {
        const view = recordView(item, allItems);
        const iconTitle = item.formType === 'Producto' ? 'Producto: artículo perteneciente a una SDI'
          : item.kind === 'Inspección' ? 'Inspección: resultados de la revisión de un producto'
          : item.kind === 'SDI' ? 'SDI: solicitud de inspección' : 'Actividad de demostración';
        return <tr key={item.id} onClick={() => onSelect(item)}>
          <td><div className="task-name">
            <span className={`task-icon ${item.kind === 'Inspección' ? 'inspect' : ''}`}><Icon name={recordIcons[item.formType || item.kind] || 'clipboard'} size={16} title={iconTitle}/></span>
            <span><strong>{item.title}</strong><small>{item.id} <i/> {item.area}</small></span>
          </div></td>
          <td><div className="owner"><div className="avatar avatar-small">{item.initials}</div>{item.owner}</div></td>
          <td><span className={`priority priority-${item.priority.toLowerCase()}`}><i/>{item.priority}</span></td>
          <td><Status status={item.status}/>{view !== 'activas' && <small className="record-view-label">{viewLabels[view]}</small>}</td>
          <td className="date-cell">{item.date}</td>
          <td><button className="row-more" aria-label={`Ver ${item.id}`} title={`Abrir detalle y acciones de ${item.id}`} onClick={event => { event.stopPropagation(); onSelect(item); }}><Icon name="more" size={17}/></button></td>
        </tr>;
      })}</tbody>
    </table>
    {items.length === 0 && <div className="empty-state">No encontramos registros con esos criterios. Prueba cambiando los filtros.</div>}
  </div>;
}

function Status({ status }) {
  const tone = status === 'En proceso' ? 'progress' : status === 'Completada' ? 'done' : status === 'Anulada' ? 'annulled' : 'pending';
  return <span className={`status status-${tone}`}><i/>{status}</span>;
}
