export async function fetchAreas({ accessToken, signal, fetchImpl = fetch } = {}) {
  if (!accessToken) throw new Error('El catálogo de áreas requiere una sesión real del backend. La sesión actual es de demostración.');
  let response;
  try {
    response = await fetchImpl('/api/areas/', {
      headers: { Authorization: `Bearer ${accessToken}` }, signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('No se pudo cargar el catálogo de áreas. Comprueba la conexión con el backend.');
  }
  if (response.status === 401) throw new Error('La sesión del backend expiró. Inicia sesión nuevamente para consultar las áreas.');
  if (response.status === 403) throw new Error('Tu perfil no tiene acceso al catálogo de áreas.');
  if (!response.ok) throw new Error('No se pudo cargar el catálogo de áreas. Comprueba la conexión con el backend.');
  const areas = await response.json().catch(() => null);
  if (!Array.isArray(areas) || areas.some(area => !area || !Number.isInteger(area.id) || typeof area.nombre !== 'string' || typeof area.activo !== 'boolean')) {
    throw new Error('El backend devolvió un catálogo de áreas inválido.');
  }
  return areas.filter(area => area.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CL'));
}
