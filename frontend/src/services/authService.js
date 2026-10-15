
const API_URL = '/api'; // Ruta base de los endpoints de Django.

// Inicia sesión y obtiene los tokens JWT del backend.
export async function iniciarSesion(username, password) {
  const response = await fetch(`${API_URL}/token/`, {
    method: 'POST', // Envía las credenciales mediante POST.
    headers: { 'Content-Type': 'application/json' }, // Formato JSON.
    body: JSON.stringify({ username, password }), // Datos del usuario.
  });

  // Informa si Django rechaza las credenciales.
  if (!response.ok) throw new Error('Usuario o contraseña incorrectos.');

  return response.json(); // Devuelve los tokens access y refresh.
}

// Consulta los datos y el rol del usuario autenticado.
export async function obtenerUsuarioActual(accessToken) {
  const response = await fetch(`${API_URL}/me/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`, // Envía el token JWT.
    },
  });

  // Detecta errores de autenticación o de consulta.
  if (!response.ok) throw new Error('No se pudo verificar el usuario.');

  return response.json(); // Devuelve los datos reales del usuario.
}

// Solicita un nuevo token de acceso cuando el anterior expira.
export async function renovarToken(refreshToken) {
  const response = await fetch(`${API_URL}/token/refresh/`, {
    method: 'POST', // Solicita la renovación a Django.
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }), // Token de renovación.
  });

  // Detecta si la sesión ya no puede renovarse.
  if (!response.ok) throw new Error('La sesión ha expirado.');

  return response.json(); // Devuelve el nuevo token de acceso.
}
