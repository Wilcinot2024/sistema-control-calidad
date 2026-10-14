import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRecordAction, recordActions, recordView } from './recordLifecycle.js';

const sdi = { id: 'SDI-1', formType: 'SDI', localId: 1, status: 'Pendiente', data: {} };
const product = { id: 'PROD-2', formType: 'Producto', localId: 2, status: 'Pendiente', data: { sdi: 1 } };
const inspection = { id: 'INS-3', formType: 'Inspección', localId: 3, status: 'En proceso', data: { item: 2 } };

test('anular requiere motivo y conserva productos en una vista histórica', () => {
  assert.throws(() => applyRecordAction([sdi, product], sdi, 'annul', '   ', true));
  const records = applyRecordAction([sdi, product], sdi, 'annul', 'Duplicada', true);
  assert.equal(records.length, 2);
  assert.equal(recordView(records[1], records), 'anuladas');
  assert.equal(records[0].annulReason, 'Duplicada');
  assert.throws(() => applyRecordAction(records, records[0], 'annul', 'Otro', true));
});

test('las inspecciones y asignaciones impiden anular o retirar productos', () => {
  assert.equal(recordActions(sdi, [sdi, product, inspection], true).annul, false);
  assert.equal(recordActions(product, [sdi, product, inspection], true).withdraw, false);
  const assigned = { ...sdi, data: { asignada: '2026-10-10' } };
  assert.equal(recordActions(assigned, [assigned, product], true).annul, false);
  assert.equal(recordActions(product, [assigned, product], true).withdraw, false);
  assert.equal(recordActions(product, [sdi, product], true).withdraw, true);
  const completed = { ...product, status: 'Completada' };
  assert.equal(recordActions(completed, [sdi, completed], true).withdraw, false);
});

test('archivar y restaurar una SDI conserva estados y alcanza sus registros', () => {
  const running = { ...sdi, status: 'En proceso' };
  let records = applyRecordAction([running, product, inspection], running, 'archive', '', true);
  assert.equal(recordView(inspection, records), 'archivadas');
  assert.equal(recordActions(inspection, records, true).archive, false);
  records = applyRecordAction(records, records[0], 'restore', '', true);
  assert.equal(recordView(inspection, records), 'activas');
  assert.equal(records[0].status, 'En proceso');
  assert.equal(records[2].status, 'En proceso');
});

test('un inspector no realiza acciones administrativas y las pendientes no se archivan', () => {
  assert.deepEqual(recordActions(sdi, [sdi], false), {});
  assert.equal(recordActions(sdi, [sdi], true).archive, false);
  assert.throws(() => applyRecordAction([inspection], inspection, 'archive', '', false));
});
