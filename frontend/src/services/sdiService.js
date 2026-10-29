import { renovarToken } from "./authService"; // Reutiliza la renovación JWT existente.
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
// ETAPA 43.3 - Recupera los últimos movimientos reales registrados por Django.
export async function obtenerActividadReciente(accessToken) {
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  const respuesta = await fetch(`${API_URL}/actividad-reciente/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`, // Autenticación JWT.
      Accept: "application/json",
    },
  });

  // Controla errores de autenticación y permisos.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }
  if (respuesta.status === 403) {
    throw new Error("No tienes permisos para consultar la actividad reciente.");
  }
  if (!respuesta.ok) {
    throw new Error(`No se pudo consultar la actividad reciente (${respuesta.status}).`);
  }

  // Devuelve únicamente movimientos registrados en el backend.
  const datos = await respuesta.json();
  if (Array.isArray(datos)) return datos;
  if (Array.isArray(datos.results)) return datos.results;

  throw new Error("El servidor devolvió un formato de historial inesperado.");
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
  // Recuperar los tokens de la sesión actual.
  let token = sessionStorage.getItem("ancor.access");
  if (!token) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Enviar los cambios al backend utilizando el token indicado.
  const enviarCambios = accessToken => fetch(`/api/sdi/${sdiId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datosActualizados),
  });

  // Primer intento de actualización.
  let respuesta = await enviarCambios(token);

  // Si el acceso expiró, renovar el JWT y reintentar una sola vez.
  if (respuesta.status === 401) {
    const refreshToken = sessionStorage.getItem("ancor.refresh");
    if (!refreshToken) {
      throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
    }

    try {
      const renovacion = await renovarToken(refreshToken);
      if (!renovacion.access) {
        throw new Error("No se recibió un nuevo token de acceso.");
      }

      // Guardar el nuevo acceso para las siguientes solicitudes.
      token = renovacion.access;
      sessionStorage.setItem("ancor.access", token);

      // Actualizar también el refresh si Django entrega uno nuevo.
      if (renovacion.refresh) {
        sessionStorage.setItem("ancor.refresh", renovacion.refresh);
      }

      // Reintentar la edición con el token renovado.
      respuesta = await enviarCambios(token);
    } catch {
      throw new Error("No se pudo renovar la sesión. Inicia sesión nuevamente.");
    }
  }

  // Procesar la respuesta de Django.
  const resultado = await respuesta.json().catch(() => ({}));

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

  // Devolver la SDI actualizada.
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
 * ETAPA 21.4 - Consultar las inspecciones existentes de un producto.
 * Evita iniciar una inspección duplicada.
 */
export async function obtenerInspeccionesItem(accessToken, itemId) {
  // Verificar la sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Consultar las inspecciones registradas en Django.
  const respuesta = await fetch(`${API_URL}/items/${itemId}/inspecciones/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Controlar errores de autenticación y permisos.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }
  if (respuesta.status === 403) {
    throw new Error("No tienes permisos para consultar estas inspecciones.");
  }
  if (!respuesta.ok) {
    throw new Error(`No se pudieron consultar las inspecciones (${respuesta.status}).`);
  }

  // Devolver las inspecciones existentes.
  const datos = await respuesta.json();
  return Array.isArray(datos) ? datos : datos.results ?? [];
}
// PASO 45.36.27.4 - Consultar y calcular el resultado real de calidad de una SDI.
export async function obtenerResultadoCalidadSDI(accessToken, sdiId) {
  // Obtener los productos asociados a la solicitud.
  const productos = await obtenerItemsSDI(accessToken, sdiId);
  if (productos.length === 0) return "Sin evaluar";

  // Consultar las inspecciones de cada producto en Django.
  const grupos = await Promise.all(productos.map(async producto => ({
    inspecciones: await obtenerInspeccionesItem(accessToken, producto.id),
  })));

  // Evitar resultados definitivos si algún producto no tiene inspecciones.
  if (grupos.some(grupo => !grupo.inspecciones.length)) return "Sin determinar";

  // Seleccionar el último intento de inspección de cada producto.
  const ultimas = grupos.map(({ inspecciones }) =>
    [...inspecciones].sort(
      (a, b) => Number(b.numero_inspeccion) - Number(a.numero_inspeccion)
    )[0]
  );

  // Comprobar si alguna inspección sigue en ejecución.
  if (ultimas.some(inspeccion => inspeccion.resultado === "en_proceso")) {
    return "En evaluación";
  }

  // Normalizar los resultados registrados en Django.
  const resultados = ultimas.map(inspeccion =>
    String(inspeccion.resultado || "").toLowerCase()
  );

  // Determinar el resultado global sin utilizar el estado administrativo.
  if (resultados.every(resultado => resultado === "aprobada")) return "Aprobada";
  if (resultados.every(resultado => resultado === "rechazada")) return "Rechazada";
  if (resultados.every(resultado =>
    ["aprobada", "rechazada", "parcial"].includes(resultado)
  )) return "Parcial";

  return "Sin determinar"; // Estados pendientes o no reconocidos.
}
// ETAPA 24.2 - Consultar los siete criterios visuales registrados.
export async function obtenerInspeccionVisual(accessToken, inspeccionId) {
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  const respuesta = await fetch(`${API_URL}/inspecciones/${inspeccionId}/visual/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo consultar la evaluación visual (${respuesta.status}).`);
  }

  return await respuesta.json();
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

/**
 * ETAPA 22 - Subir una fotografía de evidencia.
 * Django registra el archivo, usuario, fecha e inspección.
 */
export async function subirEvidenciaInspeccion(accessToken, inspeccionId, archivo, descripcion = "") {
  // Verificar que exista una sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Preparar el archivo para enviarlo a Django.
  const formulario = new FormData();
  formulario.append("tipo", "foto");
  formulario.append("archivo", archivo);
  formulario.append("descripcion", descripcion);

  // Enviar la fotografía con autenticación JWT.
  const respuesta = await fetch(`${API_URL}/inspecciones/${inspeccionId}/evidencias/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    body: formulario,
  });

  // Leer los errores o la evidencia registrada.
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    const detalle = Object.entries(datos)
      .map(([campo, mensajes]) =>
        `${campo}: ${Array.isArray(mensajes) ? mensajes.join(", ") : String(mensajes)}`
      )
      .join(" | ");

    throw new Error(detalle || `No se pudo subir la fotografía (${respuesta.status}).`);
  }

  // Devolver la evidencia guardada por Django.
  return datos;
}

/**
 * ETAPA 22 - Consultar evidencias de una inspección.
 * Permite visualizar las fotografías registradas en Django.
 */
export async function obtenerEvidenciasInspeccion(accessToken, inspeccionId) {
  // Verificar que exista una sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Consultar las evidencias asociadas a la inspección.
  const respuesta = await fetch(`${API_URL}/inspecciones/${inspeccionId}/evidencias/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Controlar errores de autenticación y permisos.
  if (respuesta.status === 401) {
    throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
  }
  if (respuesta.status === 403) {
    throw new Error("No tienes permisos para consultar estas evidencias.");
  }
  if (!respuesta.ok) {
    throw new Error(`No se pudieron consultar las evidencias (${respuesta.status}).`);
  }

  // Devolver las fotografías registradas.
  const datos = await respuesta.json();
  return Array.isArray(datos) ? datos : datos.results ?? [];
}

/**
 * ETAPA 23 - Finalizar una inspección con resultado aprobado o parcial.
 * Django valida las cantidades, criterios visuales y permisos.
 */
// Aprueba la inspección y renueva el acceso JWT si vence.
export async function aprobarInspeccion(accessToken, inspeccionId, cantidadAprobada) {
  if (!accessToken) throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");

  // Envía la aprobación al backend con el token vigente.
  const enviarAprobacion = (token) => fetch(`${API_URL}/inspecciones/${inspeccionId}/aprobar/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ cantidad_aprobada: cantidadAprobada }),
  });

  let respuesta = await enviarAprobacion(accessToken);

  // Ante un 401, renueva el token y reintenta una sola vez.
  if (respuesta.status === 401) {
    const refresh = sessionStorage.getItem("ancor.refresh");
    if (!refresh) throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");

    const tokens = await renovarToken(refresh);
    if (!tokens.access) throw new Error("No se pudo renovar la sesión.");

    sessionStorage.setItem("ancor.access", tokens.access); // Actualiza el acceso.
    if (tokens.refresh) sessionStorage.setItem("ancor.refresh", tokens.refresh);

    respuesta = await enviarAprobacion(tokens.access); // Reintenta con el nuevo JWT.
  }

  // Recupera el resultado o los errores reales de Django.
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
    }

    const detalle = Object.entries(datos)
      .map(([campo, mensajes]) =>
        `${campo}: ${Array.isArray(mensajes) ? mensajes.join(", ") : String(mensajes)}`
      )
      .join(" | ");

    throw new Error(detalle || `No se pudo finalizar la inspección (${respuesta.status}).`);
  }

  return datos; // Devuelve la aprobación confirmada por Django.
}
/**
 * ETAPA 42.5 - Iniciar formalmente una SDI.
 * Django valida el inspector asignado y el estado de la solicitud.
 */
export async function iniciarSDI(accessToken, sdiId) {
  // Verificar la sesión antes de enviar la solicitud.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Solicitar a Django el inicio formal de la SDI.
  const respuesta = await fetch(`${API_URL}/sdi/${sdiId}/iniciar/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Recuperar el resultado o el error del backend.
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
    }
    const mensaje = datos.detail || datos.error;
    throw new Error(
      typeof mensaje === "string"
        ? mensaje
        : `No se pudo iniciar la SDI (${respuesta.status}).`
    );
  }

  // Devolver el resultado confirmado por Django.
  return datos;
}
/**
 * ETAPA 42.9.35 - Finalizar formalmente una SDI.
 * El inspector envía la solicitud a revisión administrativa.
 */
export async function terminarSDI(accessToken, sdiId) {
  // Verificar que exista una sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Solicitar a Django la finalización formal de la SDI.
  const respuesta = await fetch(`${API_URL}/sdi/${sdiId}/terminar/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  // Leer la respuesta o los errores de validación.
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
    }

    // Mostrar el motivo real si Django rechaza la finalización.
    const mensaje = datos.detail || datos.error;
    throw new Error(
      typeof mensaje === "string"
        ? mensaje
        : `No se pudo finalizar la SDI (${respuesta.status}).`
    );
  }

  // Devolver la respuesta confirmada por Django.
  return datos;
}
/**
 * ETAPA 42.9.57 - Cerrar administrativamente una SDI.
 * Django valida los permisos y registra el historial.
 */
export async function cerrarSDI(accessToken, sdiId, comentario = "") {
  // Verificar la sesión activa.
  if (!accessToken) {
    throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
  }

  // Enviar la solicitud de cierre administrativo a Django.
  const respuesta = await fetch(`${API_URL}/sdi/${sdiId}/cerrar/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ comentario }),
  });

  // Leer la respuesta y los errores de validación.
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
    }

    if (respuesta.status === 403) {
      throw new Error("No tienes permisos para cerrar esta SDI.");
    }

    // Mostrar el motivo real del rechazo enviado por Django.
    const detalle = Object.entries(datos)
      .map(([campo, mensajes]) =>
        `${campo}: ${Array.isArray(mensajes) ? mensajes.join(", ") : String(mensajes)}`
      )
      .join(" | ");

    throw new Error(detalle || `No se pudo cerrar la SDI (${respuesta.status}).`);
  }

  return datos; // Devolver la SDI cerrada y confirmada por Django.
}