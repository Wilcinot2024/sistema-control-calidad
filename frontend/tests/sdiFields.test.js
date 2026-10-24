import test from 'node:test';
import assert from 'node:assert/strict';
import { digitsOnly, earliestEmissionDate, isValidEmissionDate, todayInSantiago } from '../src/components/sdiFields.js';

test('los códigos conservan ceros iniciales y excluyen letras, signos y espacios', () => {
  assert.equal(digitsOnly('00A-12/+3.4 5'), '0012345');
  assert.equal(digitsOnly('letras!?'), '');
  assert.equal(digitsOnly('00A-12/+3.4 5', 6), '001234');
});

test('el día actual se calcula en Chile aunque UTC ya esté en el día siguiente', () => {
  assert.equal(todayInSantiago(new Date('2026-10-09T02:59:00Z')), '2026-10-08');
  assert.equal(todayInSantiago(new Date('2026-10-09T03:00:00Z')), '2026-10-09');
});

test('la emisión admite solo el año actual y el anterior, hasta hoy', () => {
  const today = '2026-10-08';
  assert.equal(isValidEmissionDate('2026-10-08', today), true);
  assert.equal(isValidEmissionDate('2026-10-07', today), true);
  assert.equal(isValidEmissionDate('2025-01-01', today), true);
  assert.equal(isValidEmissionDate('2025-12-31', today), true);
  assert.equal(isValidEmissionDate('2024-12-31', today), false);
  assert.equal(isValidEmissionDate('0004-01-01', today), false);
  assert.equal(isValidEmissionDate('004-01-01', today), false);
  assert.equal(isValidEmissionDate('2026-10-09', today), false);
  assert.equal(isValidEmissionDate('9999-01-01', today), false);
  assert.equal(isValidEmissionDate('2390483290-01-01', today), false);
});

test('la emisión también rechaza fechas inexistentes y el año cero', () => {
  assert.equal(isValidEmissionDate('2024-02-29', '2025-10-08'), true);
  assert.equal(isValidEmissionDate('2025-02-29', '2026-10-08'), false);
  assert.equal(isValidEmissionDate('2026-04-31', '2026-10-08'), false);
  assert.equal(isValidEmissionDate('0000-01-01', '2026-10-08'), false);
});

test('el rango cambia automáticamente al comenzar un año nuevo', () => {
  assert.equal(earliestEmissionDate('2027-01-01'), '2026-01-01');
  assert.equal(isValidEmissionDate('2026-01-01', '2027-01-01'), true);
  assert.equal(isValidEmissionDate('2025-12-31', '2027-01-01'), false);
});
