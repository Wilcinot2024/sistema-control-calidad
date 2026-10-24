import test from 'node:test';
import assert from 'node:assert/strict';
import { articleText, boundedQuantity, nextProductOrder, productQuantity, stepQuantity } from '../src/components/productFields.js';

test('el artículo conserva tildes, ñ, puntos y guiones, y filtra otros signos', () => {
  assert.equal(articleText('Cañería metálica 82-A.1'), 'Cañería metálica 82-A.1');
  assert.equal(articleText('Artículo <A/B>_#1 + ñ@2'), 'Artículo AB1  ñ2');
  assert.equal(articleText('Can\u0303eri\u0301a'), 'Cañería');
  assert.equal(articleText('🚫!?'), '');
});

test('el artículo mantiene el límite de 250 caracteres', () => {
  assert.equal(articleText('A'.repeat(251)), 'A'.repeat(250));
});

test('el orden se calcula por SDI después del mayor existente, sin reutilizar huecos', () => {
  const productos = [
    { data: { sdi: 1, orden: 1 } },
    { data: { sdi: 1, orden: 3 } },
    { data: { sdi: 2, orden: 20 } },
  ];
  assert.equal(nextProductOrder([], 1), 1);
  assert.equal(nextProductOrder(productos, '1'), 4);
  assert.equal(nextProductOrder(productos, 2), 21);
  assert.equal(nextProductOrder(productos, 3), 1);
});

test('la cantidad es un entero desde 1 y se muestra sin ceros iniciales', () => {
  assert.equal(productQuantity('001'), 1);
  assert.equal(productQuantity('002'), 2);
  assert.equal(productQuantity('02'), 2);
  assert.equal(productQuantity(10), 10);
  for (const invalid of [0, -1, '', 'abc', 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(productQuantity(invalid), 1);
  }
});

test('los pasos de una y cinco unidades respetan el mínimo y el máximo disponible', () => {
  assert.equal(stepQuantity(1, 5), 6);
  assert.equal(stepQuantity(6, 1), 7);
  assert.equal(stepQuantity(7, -1), 6);
  assert.equal(stepQuantity(6, -5), 1);
  assert.equal(stepQuantity(2, -5), 1);
  assert.equal(stepQuantity(8, 5, 10), 10);
  assert.equal(stepQuantity(10, 1, 10), 10);
  assert.equal(stepQuantity(Number.MAX_SAFE_INTEGER - 1, 5), Number.MAX_SAFE_INTEGER);
});

test('al cambiar de producto la cantidad se ajusta a sus unidades restantes', () => {
  assert.equal(boundedQuantity(10, 2), 2);
  assert.equal(boundedQuantity(2, 10), 2);
  assert.equal(boundedQuantity(5, 0), 0);
  assert.equal(stepQuantity(0, 5, 0), 0);
  assert.equal(boundedQuantity(0, 10), 1);
});

test('cantidad aprobada puede llegar a cero sin cambiar el mínimo del registro de producto', () => {
  assert.equal(stepQuantity(2, -5, 10, 0), 0);
  assert.equal(stepQuantity(0, 5, 3, 0), 3);
  assert.equal(stepQuantity(0, -1, 3, 0), 0);
  assert.equal(stepQuantity(2, -5, 10), 1);
});
