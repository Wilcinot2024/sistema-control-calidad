import React from 'react';
import Icon from './Icon';

export default function ActivityFilters({ filter, setFilter, showAreaFilter, setShowAreaFilter, areaFilter, setAreaFilter, areaCatalog, showAreaControl = true, recordListView, onRecordListView }) {
  const selectedArea = areaCatalog.areas.find(area => String(area.id) === areaFilter);
  const chooseArea = id => { setAreaFilter(id); setShowAreaFilter(false); };
  return <div className="table-toolbar">
    <div className="filters">{['Todas','Pendiente','En proceso','Completada'].map(state => <button key={state} className={filter === state ? 'selected' : ''} onClick={() => setFilter(state)}>{state}</button>)}</div>
    {(showAreaControl || onRecordListView) && <div className="activity-filter-controls">
      {onRecordListView && <label className="record-list-view">Vista<select value={recordListView} onChange={event => onRecordListView(event.target.value)}><option value="activas">Activas</option><option value="anuladas">Anuladas</option><option value="archivadas">Archivadas</option><option value="retiradas">Productos retirados</option><option value="todas">Todas (incluye historial)</option></select></label>}
      {showAreaControl && <div className="filter-wrap">
      <button className={`filter-button ${areaFilter ? 'filter-active' : ''}`} title="Filtra por el área del inspector según el catálogo del backend." aria-expanded={showAreaFilter} onClick={() => setShowAreaFilter(!showAreaFilter)}><Icon name="filter" size={16}/> {selectedArea?.nombre ?? 'Filtrar área'}</button>
      {showAreaFilter && <div className="popover area-popover">
        <button className={!areaFilter ? 'active-option' : ''} onClick={() => chooseArea('')}>Todas las áreas</button>
        {areaCatalog.areas.map(area => <button className={String(area.id) === areaFilter ? 'active-option' : ''} key={area.id} onClick={() => chooseArea(String(area.id))}>{area.nombre}</button>)}
        {areaCatalog.loading && <p className="area-catalog-message" role="status">Cargando áreas…</p>}
        {areaCatalog.error && <p className="area-catalog-message" role="status">{areaCatalog.error}</p>}
        {!areaCatalog.loading && !areaCatalog.error && !areaCatalog.areas.length && <p className="area-catalog-message" role="status">No hay áreas activas en el catálogo.</p>}
        {areaCatalog.error && <button onClick={areaCatalog.reload}>Reintentar consulta</button>}
      </div>}
      </div>}
    </div>}
  </div>;
}
