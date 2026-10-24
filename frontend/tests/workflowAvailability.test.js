import test from 'node:test';
import assert from 'node:assert/strict';
import { canManage, canWorkInspection, resultAvailability } from '../src/pages/workflowAvailability.js';

const inspector = { id: 8, rol: 'inspector', activo: true };
const supervisor = { id: 2, rol: 'supervisor', activo: true };
const inspection = { inspector: 8, resultado: 'aprobada', actualizada: '2026-10-10T12:00:00Z', concesiones: [] };
const sdi = { asignada: '2026-10-10T10:00:00Z', estado: 'aprobada', revisada: '2026-10-10T13:00:00Z', revisada_por: 2, productos: [{ resultado_actual: 'aprobada', inspecciones: [inspection] }] };

test('management requires an active profile with an explicit backend role', () => {
  assert.equal(canManage(supervisor), true);
  assert.equal(canManage(inspector), false);
  assert.equal(canManage({ ...supervisor, activo: false }), false);
  assert.equal(canManage({ activo: true, rol: 'desconocido' }), false);
});

test('an inspector can work only their ongoing inspection of an assigned open SDI', () => {
  const ongoing = { ...inspection, resultado: 'en_proceso' };
  assert.equal(canWorkInspection(sdi, ongoing, inspector), true);
  assert.equal(canWorkInspection(sdi, { ...ongoing, inspector: 9 }, inspector), false);
  assert.equal(canWorkInspection(sdi, { ...ongoing, inspector: 9 }, supervisor), true);
  assert.equal(canWorkInspection({ ...sdi, asignada: null }, ongoing, inspector), false);
  for (const estado of ['cerrada', 'anulada']) assert.equal(canWorkInspection({ ...sdi, estado }, ongoing, inspector), false);
  assert.equal(canWorkInspection(sdi, inspection, inspector), false);
});

test('results cannot be reviewed while any inspection is ongoing', () => {
  const ongoing = { ...sdi, productos: [{ resultado_actual: 'en_proceso', inspecciones: [{ ...inspection, resultado: 'en_proceso' }] }] };
  const availability = resultAvailability(ongoing);
  assert.equal(availability.canReview, false);
  assert.equal(availability.canClose, false);
  assert.match(availability.reviewReason, /Finaliza/);
  assert.equal(resultAvailability({ ...sdi, productos: [] }).canReview, false);
});

test('closing requires a current human review even with approved products', () => {
  assert.equal(resultAvailability(sdi).canClose, true);
  assert.equal(resultAvailability({ ...sdi, revisada: null, revisada_por: null }).canClose, false);
  const changed = { ...sdi, productos: [{ resultado_actual: 'aprobada', inspecciones: [{ ...inspection, actualizada: '2026-10-10T14:00:00Z' }] }] };
  assert.match(resultAvailability(changed).closeReason, /cambiaron/);
});

test('reviewed results still cannot close with partial products or pending concessions', () => {
  const partial = { ...sdi, productos: [{ resultado_actual: 'parcial', inspecciones: [{ ...inspection, resultado: 'parcial' }] }] };
  assert.equal(resultAvailability(partial).canReview, true);
  assert.equal(resultAvailability(partial).canClose, false);
  const concession = { ...sdi, productos: [{ resultado_actual: 'rechazada', inspecciones: [{ ...inspection, concesiones: [{ decision: 'solicitada' }] }] }] };
  assert.match(resultAvailability(concession).closeReason, /concesiones/);
  assert.equal(resultAvailability({ ...sdi, estado: 'cerrada' }).canClose, false);
});
