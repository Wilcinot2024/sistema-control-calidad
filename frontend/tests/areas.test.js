import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAreas } from '../src/api/areas.js';

test('la sesión demo no consulta la API ni inventa un catálogo', async () => {
  await assert.rejects(fetchAreas({ fetchImpl: () => { throw new Error('No debe llamarse'); } }), /sesión real/);
});

test('consulta el catálogo con JWT y conserva IDs, áreas activas y nombres del backend', async () => {
  const areas = await fetchAreas({ accessToken: 'token-de-prueba', fetchImpl: async (url, options) => {
    assert.equal(url, '/api/areas/');
    assert.equal(options.headers.Authorization, 'Bearer token-de-prueba');
    return { ok: true, status: 200, json: async () => [
      { id: 20, nombre: 'Taller', activo: true },
      { id: 1, nombre: 'Oculta', activo: false },
      { id: 7, nombre: 'Calidad', activo: true },
    ] };
  } });
  assert.deepEqual(areas.map(area => area.id), [7, 20]);
});

test('distingue sesión expirada, permiso denegado y error de conexión', async () => {
  for (const [status, message] of [[401, /expiró/], [403, /no tiene acceso/], [500, /conexión/]]) {
    await assert.rejects(fetchAreas({ accessToken: 'prueba', fetchImpl: async () => ({ status, ok: false }) }), message);
  }
  await assert.rejects(fetchAreas({ accessToken: 'prueba', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), /conexión/);
});

test('rechaza una respuesta que no sea un catálogo de Area', async () => {
  await assert.rejects(fetchAreas({ accessToken: 'prueba', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ['Compras'] }) }), /inválido/);
  await assert.rejects(fetchAreas({ accessToken: 'prueba', fetchImpl: async () => ({ ok: true, status: 200, json: async () => [null] }) }), /inválido/);
  await assert.rejects(fetchAreas({ accessToken: 'prueba', fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError(); } }) }), /inválido/);
});
