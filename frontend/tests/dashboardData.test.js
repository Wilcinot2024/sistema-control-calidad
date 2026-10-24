import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardDate, inProgressByEntity, inspectorAreaId, matchesInspectorArea } from '../src/pages/dashboardData.js';

test('la cabecera muestra la fecha actual de Chile incluso si UTC ya cambió de día', () => {
  assert.equal(dashboardDate(new Date('2026-10-10T01:00:00Z')), 'VIERNES, 9 DE OCTUBRE DE 2026');
  assert.equal(dashboardDate(new Date('2026-10-10T12:00:00Z')), 'SÁBADO, 10 DE OCTUBRE DE 2026');
  assert.equal(dashboardDate(new Date('2027-01-01T12:00:00Z')), 'VIERNES, 1 DE ENERO DE 2027');
});

test('en proceso se cuenta por entidad usando su campo del backend y sin registros genéricos', () => {
  const items = [
    { formType: 'SDI', data: { estado: 'en_proceso' } },
    { formType: 'SDI', data: { estado: 'cerrada' }, status: 'En proceso' },
    { formType: 'Producto', data: { resultado_actual: 'en_proceso' } },
    { formType: 'Producto', data: {}, status: 'En proceso' },
    { formType: 'Inspección', data: { resultado: 'parcial' }, status: 'En proceso' },
    { formType: 'Inspección', status: 'En proceso' },
    { kind: 'Inspección', status: 'En proceso' },
  ];
  assert.deepEqual(inProgressByEntity(items), { SDI: 1, Producto: 2, Inspección: 1 });
  assert.deepEqual(inProgressByEntity([]), { SDI: 0, Producto: 0, Inspección: 0 });
});

test('el área se identifica por ID del catálogo, nunca por departamento o nombre', () => {
  const sdi = { formType: 'SDI', localId: 1, data: { area_inspector: { id: 7, nombre: 'Calidad' }, departamento_solicitante: 'Compras' } };
  const producto = { formType: 'Producto', data: { sdi: 1 } };
  const inspeccion = { formType: 'Inspección', data: { area_inspector: { id: 9 } } };
  const sinArea = { formType: 'SDI', area: 'Calidad', data: { departamento_solicitante: 'Calidad' } };
  const items = [sdi, producto, inspeccion, sinArea];
  assert.equal(inspectorAreaId(producto, items), 7);
  assert.equal(matchesInspectorArea(producto, '7', items), true);
  assert.equal(matchesInspectorArea(inspeccion, '7', items), false);
  assert.equal(matchesInspectorArea(sinArea, '7', items), false);
  assert.equal(matchesInspectorArea(sinArea, '', items), true);
});
