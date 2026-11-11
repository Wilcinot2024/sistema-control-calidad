
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

// PASO 48.4.47 - Recuperar el usuario renovando JWT ante un 401.
export async function obtenerUsuarioActual(accessToken) {
  // Consultar el perfil utilizando el token de acceso.
  const consultarUsuario = token => fetch(`${API_URL}/me/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let response = await consultarUsuario(accessToken);

  // Renovar únicamente cuando el access token ya no sea válido.
  if (response.status === 401) {
    const refresh = sessionStorage.getItem("ancor.refresh");
    if (!refresh) throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");

    const tokens = await renovarToken(refresh); // Usar la renovación existente.
    if (!tokens.access) throw new Error("No se pudo renovar la sesión.");

    sessionStorage.setItem("ancor.access", tokens.access); // Actualizar acceso.
    if (tokens.refresh) sessionStorage.setItem("ancor.refresh", tokens.refresh);

    response = await consultarUsuario(tokens.access); // Reintentar una sola vez.
  }

  // Informar los errores reales de autenticación o consulta.
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "La sesión ha expirado. Inicia sesión nuevamente."
        : `No se pudo verificar el usuario (${response.status}).`
    );
  }

  return response.json(); // Devolver los datos del usuario.
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

// PASO 48.4.49 - Compartir una renovación JWT entre las peticiones.
let renovacionPendiente = null;

// Ejecutar una petición autenticada y renovar el JWT cuando Django responda 401.
export async function fetchAutenticado(url, opciones = {}) {
  // Utilizar el token vigente de la sesión.
  const token = sessionStorage.getItem("ancor.access");
  if (!token) throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");

  // Conservar los encabezados originales de cada petición.
  const headers = new Headers(opciones.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  let respuesta = await fetch(url, { ...opciones, headers });

  // Si Django acepta el token, conservar su respuesta original.
  if (respuesta.status !== 401) return respuesta;

  const refresh = sessionStorage.getItem("ancor.refresh");
  if (!refresh) throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");

  // Evitar renovaciones simultáneas cuando varias consultas reciben 401.
  if (!renovacionPendiente) {
    renovacionPendiente = renovarToken(refresh)
      .then(tokens => {
        if (!tokens.access) throw new Error("No se pudo renovar la sesión.");
        sessionStorage.setItem("ancor.access", tokens.access);
        if (tokens.refresh) sessionStorage.setItem("ancor.refresh", tokens.refresh);
        return tokens.access;
      })
      .finally(() => { renovacionPendiente = null; });
  }

  // Reintentar una sola vez con el nuevo token.
  const nuevoToken = await renovacionPendiente;
  headers.set("Authorization", `Bearer ${nuevoToken}`);
  respuesta = await fetch(url, { ...opciones, headers });

  return respuesta; // Mantener la gestión HTTP original del servicio.
}
