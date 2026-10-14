import { relatedSdi, recordView } from './recordLifecycle.js';

export const activityCsvHeaders = [
  'Código del registro', 'Tipo de registro', 'Actividad / artículo', 'Código SDI',
  'Producto relacionado', 'Proyecto', 'Departamento solicitante', 'Ubicación de la actividad', 'Área del inspector',
  'Responsable', 'Prioridad', 'Estado', 'Vista del registro', 'Fecha / referencia',
  'Cantidad indicada', 'Cantidad a inspeccionar', 'Cantidad inspeccionada',
  'Cantidad aprobada', 'Observaciones',
];

const views = { activas: 'Activas', anuladas: 'Anuladas', archivadas: 'Archivadas', retiradas: 'Retiradas' };

export function csvDate(value) {
  if (!value) return '';
  const date = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const local = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  // Las referencias de la demo como "Hoy, 10:30" no tienen una fecha real guardada.
  return date;
}

export function activityCsvRows(records, allRecords) {
  return records.map(record => {
    const data = record.data || {};
    const sdi = relatedSdi(record, allRecords);
    const product = record.formType === 'Producto' ? record
      : record.formType === 'Inspección' ? allRecords.find(entry => entry.formType === 'Producto' && entry.localId === data.item) : null;
    const area = data.area_inspector === undefined ? sdi?.data?.area_inspector : data.area_inspector;
    return [
      record.id, record.formType || record.kind, record.title, sdi?.data?.codigo_sdi || sdi?.id,
      product?.data?.articulo, sdi?.data?.proyecto, sdi?.data?.departamento_solicitante,
      record.formType ? '' : record.area,
      area?.nombre, record.owner, record.priority === '—' ? '' : record.priority,
      record.status, views[recordView(record, allRecords)], csvDate(data.fecha_emision || record.date),
      product?.data?.cantidad_indicada, product?.data?.cantidad_a_inspeccionar,
      record.formType === 'Inspección' ? data.cantidad_inspeccionada : '',
      record.formType === 'Inspección' ? data.cantidad_aprobada : '',
      record.observation ?? data.observaciones,
    ];
  });
}

export function serializeCsv(headers, rows) {
  const cell = value => {
    let text = String(value ?? '').replaceAll('\0', '');
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  // BOM para tildes/ñ y separador explícito para abrir directamente en Excel.
  return '\uFEFFsep=;\r\n' + [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}

export function downloadCsv(headers, rows, filename) {
  const url = URL.createObjectURL(new Blob([serializeCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
