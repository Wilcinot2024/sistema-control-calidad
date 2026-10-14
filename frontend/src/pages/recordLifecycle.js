export function relatedSdi(item, items) {
  if (item.formType === 'SDI') return item;
  const product = item.formType === 'Inspección' ? items.find(entry => entry.formType === 'Producto' && entry.localId === item.data?.item) : item;
  return items.find(entry => entry.formType === 'SDI' && entry.localId === product?.data?.sdi);
}

export function recordView(item, items) {
  const sdi = relatedSdi(item, items);
  if (item.withdrawn) return 'retiradas';
  if (item.archived || sdi?.archived) return 'archivadas';
  if (item.status === 'Anulada' || sdi?.status === 'Anulada') return 'anuladas';
  return 'activas';
}

export function recordActions(item, items, manager) {
  if (!manager || item.withdrawn) return {};
  const sdi = relatedSdi(item, items);
  const products = sdi ? items.filter(entry => entry.formType === 'Producto' && entry.data?.sdi === sdi.localId) : [];
  const inspections = items.filter(entry => entry.formType === 'Inspección' && products.some(product => product.localId === entry.data?.item));
  const view = recordView(item, items);
  return {
    annul: view === 'activas' && item.formType === 'SDI' && item.status === 'Pendiente' && !item.data?.asignada && !inspections.length,
    withdraw: view === 'activas' && item.formType === 'Producto' && item.status === 'Pendiente' && sdi?.status === 'Pendiente' && !sdi.data?.asignada && !inspections.some(entry => entry.data?.item === item.localId),
    archive: !item.archived && !sdi?.archived && ['En proceso', 'Completada', 'Anulada'].includes(item.status),
    restore: !!item.archived && (sdi === item || !sdi?.archived),
  };
}

export function applyRecordAction(items, item, action, reason, manager, now = new Date().toISOString()) {
  if (!recordActions(item, items, manager)[action]) throw new Error('Esta acción no está permitida para el estado o rol actual.');
  if (action === 'annul' && (!reason?.trim() || reason.trim().length > 1000)) throw new Error('Indica un motivo de entre 1 y 1000 caracteres.');
  const fields = action === 'annul' ? { status: 'Anulada', annulled: now, annulReason: reason.trim() }
    : action === 'withdraw' ? { withdrawn: now }
      : { archived: action === 'archive' ? now : null };
  return items.map(entry => entry.id === item.id ? { ...entry, ...fields } : entry);
}
