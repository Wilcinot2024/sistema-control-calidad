
const API_URL = "/api";

// Obtiene todas las solicitudes de inspección del backend.
export async function obtenerSDI(accessToken) {
  const respuesta = await fetch(`${API_URL}/sdi/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Verifica que el usuario tenga una sesión válida.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Informa cualquier otro error HTTP.
  if (!respuesta.ok) {
    throw new Error(`No se pudieron consultar las SDI (${respuesta.status}).`);
  }

  const datos = await respuesta.json();

  // Acepta respuestas normales y paginadas de Django REST Framework.
  if (Array.isArray(datos)) return datos;
  if (Array.isArray(datos.results)) return datos.results;

  throw new Error("El servidor devolvió un formato de SDI inesperado.");
}

// Obtiene los inspectores registrados y autorizados por Django.
export async function obtenerInspectores(accessToken) {
  const respuesta = await fetch(`${API_URL}/inspectores/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Verifica la autenticación.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Controla los errores de la consulta.
  if (!respuesta.ok) {
    throw new Error(`No se pudieron cargar los inspectores (${respuesta.status}).`);
  }

  const datos = await respuesta.json();

  // Devuelve los inspectores como un arreglo.
  if (Array.isArray(datos)) return datos;
  if (Array.isArray(datos.results)) return datos.results;

  throw new Error("El servidor devolvió un formato de inspectores inesperado.");
}

// Registra una nueva SDI utilizando las validaciones reales del backend.
export async function crearSDI(accessToken, datosSDI) {
  const respuesta = await fetch(`${API_URL}/sdi/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(datosSDI),
  });

  // Lee la respuesta del servidor, incluso cuando contiene errores.
  const datos = await respuesta.json().catch(() => ({}));

  // Si Django rechaza la solicitud, muestra los errores de validación.
  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
    }

    const detalle = Object.entries(datos)
      .map(([campo, mensajes]) => {
        const texto = Array.isArray(mensajes)
          ? mensajes.join(", ")
          : String(mensajes);
        return `${campo}: ${texto}`;
      })
      .join(" | ");

    throw new Error(detalle || `No se pudo crear la SDI (${respuesta.status}).`);
  }

  // Devuelve la SDI creada con su ID y código generado por Django.
  return datos;
}

/**
 * ETAPA 15.3 - Editar una solicitud SDI existente.
 * Envía únicamente los campos modificados al backend Django.
 * No crea una nueva solicitud.
 */
export async function editarSDI(sdiId, datosActualizados) {
  // Recuperar el token JWT de la sesión actual.
  const token = sessionStorage.getItem("ancor.access");

  // Evitar peticiones sin autenticación.
  if (!token) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Enviar los cambios a la SDI seleccionada.
  const respuesta = await fetch(`/api/sdi/${sdiId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datosActualizados),
  });

  // Leer la respuesta del backend.
  const resultado = await respuesta.json().catch(() => ({}));

  // Mostrar los errores devueltos por Django.
  if (!respuesta.ok) {
    const detalle = Object.entries(resultado)
      .map(([campo, mensaje]) => {
        const texto = Array.isArray(mensaje)
          ? mensaje.join(", ")
          : String(mensaje);
        return `${campo}: ${texto}`;
      })
      .join(" | ");

    throw new Error(detalle || "No se pudo actualizar la solicitud SDI.");
  }

  // Devolver la SDI actualizada por PostgreSQL/Django.
  return resultado;
}

/**
 * ETAPA 17.22 - Activar o desactivar un inspector.
 * Django valida los permisos y actualiza el estado real.
 */
export async function cambiarEstadoInspector(accessToken, inspectorId, activo) {
  // Enviar el nuevo estado al backend.
  const respuesta = await fetch(`${API_URL}/inspectores/${inspectorId}/estado/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ activo }),
  });

  // Leer la respuesta de Django, incluso si contiene errores.
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
    }

    // Mostrar los mensajes de validación del backend.
    const detalle = Object.entries(datos)
      .map(([campo, mensajes]) => {
        const texto = Array.isArray(mensajes)
          ? mensajes.join(", ")
          : String(mensajes);
        return `${campo}: ${texto}`;
      })
      .join(" | ");

    throw new Error(detalle || `No se pudo actualizar el inspector (${respuesta.status}).`);
  }

  // Devolver el inspector con su estado actualizado.
  return datos;
}


/**
 * ETAPA 17 - Registrar un inspector en Django.
 * El backend valida los permisos y crea la cuenta.
 */
export async function crearInspector(accessToken, datosInspector) {
  // Enviar los datos del nuevo inspector a Django.
  const respuesta = await fetch(`${API_URL}/inspectores/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(datosInspector),
  });

  // Leer la respuesta, incluidos los errores de validación.
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
    }

    // Mostrar los errores específicos enviados por Django.
    const detalle = Object.entries(datos)
      .map(([campo, mensajes]) => {
        const texto = Array.isArray(mensajes)
          ? mensajes.join(", ")
          : String(mensajes);
        return `${campo}: ${texto}`;
      })
      .join(" | ");

    throw new Error(detalle || `No se pudo registrar el inspector (${respuesta.status}).`);
  }

  // Devolver el inspector registrado.
  return datos;
}

/**
 * ETAPA 18.3 - Obtener los productos asociados a una SDI.
 * Django controla que el inspector tenga acceso a la solicitud.
 */
export async function obtenerItemsSDI(accessToken, sdiId) {
  // Verificar que exista una sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Solicitar a Django los productos de la SDI seleccionada.
  const respuesta = await fetch(`${API_URL}/sdi/${sdiId}/items/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Controlar los errores de autenticación y permisos.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }
  if (respuesta.status === 403) {
    throw new Error("No tienes permisos para consultar estos productos.");
  }
  if (respuesta.status === 404) {
    throw new Error("La SDI no existe o no está disponible para tu usuario.");
  }
  if (!respuesta.ok) {
    throw new Error(`No se pudieron consultar los productos (${respuesta.status}).`);
  }

  // Convertir la respuesta de Django en una lista de productos.
  const datos = await respuesta.json();
  if (Array.isArray(datos)) return datos;
  if (Array.isArray(datos.results)) return datos.results;

  // Avisar si Django devuelve un formato inesperado.
  throw new Error("El servidor devolvió un formato de productos inesperado.");
}
/**
 * ETAPA 18.4 - Registrar un producto en una SDI.
 * Django valida permisos, cantidades y número de orden.
 */
export async function crearItemSDI(accessToken, sdiId, datosItem) {
  // Comprobar que exista una sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Enviar los datos del producto al backend.
  const respuesta = await fetch(`${API_URL}/sdi/${sdiId}/items/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(datosItem),
  });

  // Interpretar la respuesta de Django.
  const datos = await respuesta.json().catch(() => ({}));

  // Controlar errores de autenticación y permisos.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }
  if (respuesta.status === 403) {
    throw new Error("No tienes permisos para registrar productos.");
  }
  if (respuesta.status === 404) {
    throw new Error("La SDI no existe o no está disponible.");
  }

  // Mostrar los errores de validación devueltos por Django.
  if (!respuesta.ok) {
    const mensaje = datos.detail || datos.non_field_errors?.[0];
    throw new Error(
      typeof mensaje === "string"
        ? mensaje
        : `No se pudo registrar el producto (${respuesta.status}).`
    );
  }

  // Devolver el producto creado con su identificador real.
  return datos;
}

/**
 * ETAPA 21.1 - Iniciar una inspección de un producto.
 * Django valida que el inspector esté asignado a la SDI.
 */
export async function iniciarInspeccion(accessToken, itemId, datosInspeccion) {
  // Verificar que exista una sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Enviar la inspección al backend Django.
  const respuesta = await fetch(`${API_URL}/items/${itemId}/inspecciones/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(datosInspeccion),
  });

  // Leer la respuesta del backend.
  const datos = await respuesta.json().catch(() => ({}));

  // Controlar errores de autenticación y permisos.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }
  if (respuesta.status === 403) {
    throw new Error("No tienes permisos para iniciar esta inspección.");
  }

  // Mostrar los errores de validación de Django.
  if (!respuesta.ok) {
    const mensaje = datos.detail || datos.non_field_errors?.[0];
    throw new Error(
      typeof mensaje === "string"
        ? mensaje
        : `No se pudo iniciar la inspección (${respuesta.status}).`
    );
  }

  // Devolver la inspección creada en PostgreSQL.
  return datos;
}
/**
 * ETAPA 21.3 - Registrar la inspección visual.
 * Django valida los criterios y calcula el resultado.
 */
export async function registrarInspeccionVisual(accessToken, inspeccionId, datosVisual) {
  // Verificar que exista una sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Enviar los siete criterios visuales a Django.
  const respuesta = await fetch(`${API_URL}/inspecciones/${inspeccionId}/visual/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(datosVisual),
  });

  // Leer la respuesta, incluidos los errores de validación.
  const datos = await respuesta.json().catch(() => ({}));

  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }
  if (respuesta.status === 403) {
    throw new Error("No tienes permisos para registrar esta inspección visual.");
  }

  // Mostrar el mensaje real de Django cuando rechaza los datos.
  if (!respuesta.ok) {
    const detalle = Array.isArray(datos)
      ? datos.join(", ")
      : Object.entries(datos)
          .map(([campo, mensajes]) =>
            `${campo}: ${Array.isArray(mensajes) ? mensajes.join(", ") : String(mensajes)}`
          )
          .join(" | ");

    throw new Error(detalle || `No se pudo registrar la inspección visual (${respuesta.status}).`);
  }

  // Devolver el registro creado con el resultado calculado.
  return datos;
}