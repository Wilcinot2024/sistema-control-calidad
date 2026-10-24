export function dashboardDate(now = new Date()) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now).toLocaleUpperCase('es-CL');
}

export function inProgressByEntity(items) {
  const counts = { SDI: 0, Producto: 0, Inspección: 0 };
  const fields = { SDI: 'estado', Producto: 'resultado_actual', Inspección: 'resultado' };
  for (const item of items) {
    const field = fields[item.formType];
    if (!field) continue;
    // Los registros locales usan status hasta recibir los estados de la API.
    const status = item.data?.[field] ?? item.status;
    if (status === 'en_proceso' || status === 'En proceso') counts[item.formType] += 1;
  }
  return counts;
}

export function inspectorAreaId(item, items) {
  if (item.formType === 'Producto') {
    if (item.data?.area_inspector !== undefined) return item.data.area_inspector?.id ?? null;
    const sdi = items.find(record => record.formType === 'SDI' && record.localId === item.data?.sdi);
    return sdi?.data?.area_inspector?.id ?? null;
  }
  return item.data?.area_inspector?.id ?? null;
}

export function matchesInspectorArea(item, selectedArea, items) {
  return selectedArea === '' || String(inspectorAreaId(item, items)) === String(selectedArea);
}
