const key = 'ancor.api.tokens';
let tokens;
try { tokens = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { tokens = null; }
let refreshing;
export const hasSession = () => Boolean(tokens);
export function clearSession() { tokens = null; sessionStorage.removeItem(key); }
function save(value) { tokens = value; sessionStorage.setItem(key, JSON.stringify(value)); }
function errorText(value) {
  if (Array.isArray(value)) return value.map(errorText).join(' ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k === 'detail' || k === 'non_field_errors' ? '' : k + ': '}${errorText(v)}`).join(' ');
  return String(value || 'No se pudo completar la operación.');
}
export async function api(path, { method = 'GET', data, file = false, retry = true } = {}) {
  const headers = tokens ? { Authorization: `Bearer ${tokens.access}` } : {};
  if (data && !(data instanceof FormData)) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(path, { method, headers, body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined }); }
  catch { throw new Error('No se pudo conectar con el backend. Comprueba que esté iniciado.'); }
  if (response.status === 401 && tokens?.refresh && retry && path !== '/api/token/') {
    refreshing ||= fetch('/api/token/refresh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: tokens.refresh }) }).then(async r => {
      if (!r.ok) { clearSession(); throw new Error('La sesión expiró. Vuelve a iniciar sesión.'); }
      save({ ...tokens, ...await r.json() });
    }).finally(() => { refreshing = null; });
    await refreshing;
    return api(path, { method, data, file, retry: false });
  }
  if (!response.ok) { let body; try { body = await response.json(); } catch { body = 'El backend devolvió un error.'; } throw new Error(errorText(body)); }
  return response.status === 204 ? null : file ? response.blob() : response.json();
}
export async function login(username, password) { save(await api('/api/token/', { method: 'POST', data: { username, password } })); return api('/api/me/'); }
export async function downloadFile(path, name) {
  const blob = await api(path, { file: true });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
