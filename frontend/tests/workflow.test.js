import test from 'node:test';
import assert from 'node:assert/strict';
const storage = new Map();
globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const { api, login, hasSession, clearSession } = await import('../src/api/workflow.js');
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

test('login uses real JWT, persists no password and sends bearer on me', async () => {
  clearSession(); const calls = [];
  globalThis.fetch = async (path, options) => { calls.push([path, options]); return response(path === '/api/token/' ? { access: 'access-one', refresh: 'refresh-one' } : { username: 'boss', activo: true }); };
  assert.equal((await login('boss', 'private-password')).username, 'boss');
  assert.equal(calls[1][1].headers.Authorization, 'Bearer access-one');
  assert.equal(storage.get('ancor.api.tokens').includes('private-password'), false);
  assert.equal(hasSession(), true);
});

test('expired access requests share one refresh and retry with new bearer', async () => {
  let refreshes = 0;
  globalThis.fetch = async (path, options) => {
    if (path === '/api/token/refresh/') { refreshes++; await new Promise(resolve => setTimeout(resolve, 5)); return response({ access: 'access-two' }); }
    return options.headers.Authorization === 'Bearer access-two' ? response(['visible']) : response({ detail: 'expired' }, 401);
  };
  const results = await Promise.all([api('/api/sdi/'), api('/api/dashboard/')]);
  assert.equal(refreshes, 1); assert.deepEqual(results, [['visible'], ['visible']]);
});

test('refresh rejection clears session; backend validation reaches user', async () => {
  globalThis.fetch = async () => response({ detail: 'expired' }, 401);
  await assert.rejects(api('/api/sdi/'), /sesión expiró/); assert.equal(hasSession(), false);
  globalThis.fetch = async () => response({ cantidad_a_inspeccionar: ['Debe ser positiva.'] }, 400);
  await assert.rejects(api('/api/sdi/'), /cantidad_a_inspeccionar: Debe ser positiva/);
});
