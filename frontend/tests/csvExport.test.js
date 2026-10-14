import test from 'node:test';
import assert from 'node:assert/strict';
import { activityCsvHeaders, activityCsvRows, csvDate, serializeCsv } from '../src/pages/csvExport.js';

const sdi = { id: 'SDI-001-002', formType: 'SDI', localId: 1, status: 'En proceso', data: { proyecto: 'Proyecto Ñuble', departamento_solicitante: 'Bodega', area_inspector: { id: 4, nombre: 'Calidad' } } };
const product = { id: 'PROD-2', formType: 'Producto', localId: 2, status: 'En proceso', data: { sdi: 1, articulo: 'Pieza A-1', cantidad_indicada: 20, cantidad_a_inspeccionar: 5 } };
const inspection = { id: 'INS-3', formType: 'Inspección', localId: 3, title: 'Inspección de pieza', status: 'Completada', owner: 'José Muñoz', priority: '—', date: '10/10/2026', observation: 'Golpe; revisar "lado A"\nSegunda observación', data: { item: 2, cantidad_inspeccionada: 5, cantidad_aprobada: 0, area_inspector: { id: 8, nombre: 'Inspección visual' } } };

test('exporta solo los registros filtrados y resuelve sus relaciones fuera de la lista visible', () => {
  const rows = activityCsvRows([inspection], [sdi, product, inspection]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, activityCsvHeaders.length);
  const row = Object.fromEntries(activityCsvHeaders.map((header, index) => [header, rows[0][index]]));
  assert.equal(row['Código SDI'], 'SDI-001-002');
  assert.equal(row['Producto relacionado'], 'Pieza A-1');
  assert.equal(row.Proyecto, 'Proyecto Ñuble');
  assert.equal(row['Departamento solicitante'], 'Bodega');
  assert.equal(row['Área del inspector'], 'Inspección visual');
  assert.equal(row['Cantidad indicada'], 20);
  assert.equal(row['Cantidad a inspeccionar'], 5);
  assert.equal(row['Cantidad inspeccionada'], 5);
  assert.equal(row['Cantidad aprobada'], 0);
  assert.equal(row['Fecha / referencia'], '2026-10-10');
});

test('no inventa un área del inspector a partir del departamento de la demo', () => {
  const noArea = { ...sdi, area: 'Bodega', data: { ...sdi.data, area_inspector: null } };
  const [row] = activityCsvRows([product], [noArea, product]);
  assert.equal(row[activityCsvHeaders.indexOf('Departamento solicitante')], 'Bodega');
  assert.equal(row[activityCsvHeaders.indexOf('Área del inspector')], undefined);
  assert.equal(serializeCsv(activityCsvHeaders, [row]).includes('undefined'), false);
});

test('conserva la ubicación de actividades antiguas sin presentarla como área del catálogo', () => {
  const legacy = { id: 'ACT-1', kind: 'Actividad', title: 'Revisar certificados', area: 'Recepción', status: 'Pendiente' };
  const [row] = activityCsvRows([legacy], [legacy]);
  assert.equal(row[activityCsvHeaders.indexOf('Ubicación de la actividad')], 'Recepción');
  assert.equal(row[activityCsvHeaders.indexOf('Área del inspector')], undefined);
});

test('el CSV declara separador y UTF-8 y conserva delimitadores, comillas, tildes y saltos dentro de una celda', () => {
  const csv = serializeCsv(['Código', 'Observación'], [['SDI-001-002', inspection.observation], ['José Ñuble', null]]);
  assert.equal(csv, '\uFEFFsep=;\r\n"Código";"Observación"\r\n"SDI-001-002";"Golpe; revisar ""lado A""\nSegunda observación"\r\n"José Ñuble";""\r\n');
});

test('las observaciones no se convierten en fórmulas al abrir el CSV', () => {
  assert.equal(serializeCsv(['Texto', 'Cantidad'], [['=1+1', 0]]), '\uFEFFsep=;\r\n"Texto";"Cantidad"\r\n"\'=1+1";"0"\r\n');
});

test('normaliza fechas guardadas sin inventar fechas para referencias de demostración', () => {
  assert.equal(csvDate('9/10/2026'), '2026-10-09');
  assert.equal(csvDate('2026-10-10'), '2026-10-10');
  assert.equal(csvDate('Hoy, 10:30'), 'Hoy, 10:30');
});
