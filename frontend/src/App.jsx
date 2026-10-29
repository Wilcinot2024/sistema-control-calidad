
import React, { useEffect, useMemo, useRef, useState } from "react";
import logoAncor from "./assets/Logotipo ANCOR TECMIN.png";
import { iniciarSesion, obtenerUsuarioActual } from "./services/authService";
// Servicios para gestionar SDI e inspectores mediante Django.
import {
   obtenerSDI,
  obtenerActividadReciente, // ETAPA 43.3 - Historial real del Dashboard.
  obtenerInspectores,
  crearSDI,
  editarSDI,
  crearInspector,
  cambiarEstadoInspector,
  obtenerItemsSDI,
  crearItemSDI, // ETAPA 18.4 - Registrar productos en Django.
  iniciarInspeccion,
  registrarInspeccionVisual, // guardar evaluacion visual.
  obtenerInspeccionVisual, // Consultar los siete criterios visuales.
  obtenerResultadoCalidadSDI, // PASO 45.36.27.5 - Resultado real de calidad.
  obtenerInspeccionesItem, // ETAPA 21.4 - Recuperar inspecciones existentes.
  subirEvidenciaInspeccion, // ETAPA 22 - Subir fotografías a Django.
  obtenerEvidenciasInspeccion, // ETAPA 22 - Consultar evidencias registradas.
  aprobarInspeccion,
  iniciarSDI,
  terminarSDI, // ETAPA 42.7 - Inicio formal de la SDI en Django.
  cerrarSDI

} from "./services/sdiService";

// Recupera datos de demostración guardados en este navegador.
function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

// Iconos SVG utilizados por el diseño original.
function Icon({ name, size = 19 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M8 11h8M8 15h5"/></>,
    check: <><path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m8 13 2.5 2.5L16 10"/></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8a4 4 0 0 1-2 3.5M22 21v-2a4 4 0 0 0-3-3.87"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4L7 15a8 8 0 0 1 0-2l-1.4-1.1L7 9.5l1.7.7a8 8 0 0 1 1.8-1l1.7-.7 1.4 2.4L19.4 13a8 8 0 0 1 0 2Z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    // PASO 45.32.15.2 - Icono del menú lateral de la barra superior.
menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    
      // Icono de lápiz para editar solicitudes SDI.
      edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></>,
    filter: <><path d="M4 6h16M7 12h10m-7 6h4"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
        // Iconos SVG del formulario de autenticación.
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18M10 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.5M6 6.5C3.5 8.4 2 12 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.9-.8"/></>,
    shield: <><path d="M12 2 20 5v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5Z"/><path d="m9 12 2 2 4-4"/></>,
    chartUp: <><path d="M4 20V12M10 20V15M16 20V9M22 20V4M3 21h19M4 11l6-4 5 3 6-7"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
function App() {
  const [period, setPeriod] = useState(() => readJson("ancor.demo.period.v1", "Esta semana"));
  const [notificationOpen, setNotificationOpen] = useState(false); // Controla la apertura del menú de notificaciones.
  // Datos reales de solicitudes.
  const [sdis, setSdis] = useState([]);
  const [sdiLoading, setSdiLoading] = useState(false);
  const [sdiError, setSdiError] = useState("");
  const [selectedSdi, setSelectedSdi] = useState(null);
// PASO 45.36.27.2 - Almacena el resultado de calidad de cada SDI.
const [resultadosCalidad, setResultadosCalidad] = useState({});
  
    // PASO 45.30 - Control de paginación de Gestión de SDI.
    const [paginaSdi, setPaginaSdi] = useState(1); // Página actual.
    const registrosPorPagina = 10; // Máximo de solicitudes por página.

  // ETAPA 43.3 - Estado de los movimientos reales del Dashboard.
  const [actividadReciente, setActividadReciente] = useState([]);
  const [actividadLoading, setActividadLoading] = useState(false);
  const [actividadError, setActividadError] = useState("");
    // ETAPA 42.7 - Actualizar el listado y el detalle después de iniciar una SDI.
  const actualizarSdiIniciada = async sdiActualizada => {
    // Reflejar inmediatamente el estado confirmado por Django.
    setSelectedSdi(sdiActualizada);
    setSdis(actuales => actuales.map(s =>
      s.id === sdiActualizada.id ? sdiActualizada : s
    ));

    // Sincronizar nuevamente el listado con PostgreSQL.
    try {
      const token = sessionStorage.getItem("ancor.access");
      const actualizadas = await obtenerSDI(token);
      setSdis(actualizadas);
      const confirmada = actualizadas.find(s => s.id === sdiActualizada.id);
      if (confirmada) setSelectedSdi(confirmada);
      setSdiError("");
    } catch (error) {
      setSdiError(`La SDI fue iniciada, pero no se pudo actualizar el listado: ${error.message}`);
    }
  };

  // Estados del formulario real de creación.
  const [showNuevaSdi, setShowNuevaSdi] = useState(false);
  const [inspectores, setInspectores] = useState([]);
  const [inspectoresLoading, setInspectoresLoading] = useState(false);
  const [nuevaSdiError, setNuevaSdiError] = useState("");
  const [guardandoSdi, setGuardandoSdi] = useState(false);

  // ============================================================
  // ETAPA 15 - EDICIÓN DE SOLICITUDES SDI
  // ============================================================

  // Estados para controlar el formulario de edición.
  const [sdiEnEdicion, setSdiEnEdicion] = useState(null);
  const [editarSdiError, setEditarSdiError] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // ============================================================
  // AUTENTICACIÓN REAL CON DJANGO
  // ============================================================

  // Información del usuario autenticado.
  const [session, setSession] = useState(null);

  // Controla la verificación inicial del token JWT.
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  // Estados del inicio de sesión.
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  // ============================================================
  // PERMISOS DE EDICIÓN SDI
  // ============================================================

  // Roles autorizados para editar solicitudes desde Django.
  const rolesPermitidos = [
    "administrador",
    "jefe_calidad",
    "supervisor"
  ];

  // Verifica el rol recibido desde /api/me/.
  const puedeEditarSdi = rolesPermitidos.includes(session?.roleCode);
  // Diagnóstico: verificar los permisos del usuario autenticado.
console.log("Usuario:", session?.name);
console.log("Rol Django:", session?.roleCode);
console.log("Puede crear SDI:", puedeEditarSdi);
 // Navegación principal del sistema.
const [activeNav, setActiveNav] = useState("Panel de control");

// Búsqueda general de solicitudes SDI.
const [query, setQuery] = useState("");

// PASO 45.7 - Filtros de Gestión de SDI según los campos disponibles.
const [filtroEstado, setFiltroEstado] = useState("todos"); // Estado de la solicitud.
const [filtroOrigen, setFiltroOrigen] = useState("todos"); // Departamento solicitante.
const [filtroFecha, setFiltroFecha] = useState(""); // Fecha de emisión.

  // PASO 45.30.5 - Regresa a la primera página cuando cambian los filtros.
  useEffect(() => {
    setPaginaSdi(1); // Evita mostrar una página vacía después de filtrar.
  }, [query, filtroEstado, filtroOrigen, filtroFecha]);


// Controla la expansión del menú lateral.
const [collapsed, setCollapsed] = useState(false);
  // Ventanas y acciones locales.
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false); // Controla la apertura y cierre del formulario de registro de inspectores.
  const searchRef = useRef(null);

  // Consulta las SDI reales después de iniciar sesión.
  // ETAPA 17 - Recuperar la sesión JWT al cargar la aplicación.
useEffect(() => {
  let vigente = true;

  const recuperarSesion = async () => {
    const token = sessionStorage.getItem("ancor.access");

    // Sin token, permitir que aparezca el formulario de acceso.
    if (!token) {
      if (vigente) setVerificandoSesion(false);
      return;
    }

    try {
      // Validar el token y recuperar los datos reales desde Django.
      const usuario = await obtenerUsuarioActual(token);

      if (!usuario.activo) {
        throw new Error("El perfil del usuario está desactivado.");
      }

      const nombre = [usuario.first_name, usuario.last_name]
        .filter(Boolean).join(" ") || usuario.username;

      if (vigente) {
        setSession({
          name: nombre,
          email: usuario.email || "",
          role: usuario.rol_nombre || usuario.rol,
          roleCode: usuario.rol,
        });
      }
    } catch {
      // Eliminar los tokens si Django rechaza la sesión.
      sessionStorage.removeItem("ancor.access");
      sessionStorage.removeItem("ancor.refresh");
    } finally {
      if (vigente) setVerificandoSesion(false);
    }
  };

  recuperarSesion();

  return () => { vigente = false; };
}, []);
  useEffect(() => {
    if (!session) {
      setSdis([]);
      setSdiError("");
      return;
    }
    const token = sessionStorage.getItem("ancor.access");
    if (!token) {
      setSdiError("No se encontró el token de acceso.");
      return;
    }
    let vigente = true;
    setSdiLoading(true);
    obtenerSDI(token)
      .then(datos => {
        if (vigente) {
          // PASO 45.18 - Verifica los nombres de solicitantes recibidos desde Django.
console.log("Solicitantes recibidos:", datos.map(sdi => ({
  codigo: sdi.codigo_sdi,          // Número de solicitud SDI.
  solicitante: sdi.solicitante,    // Nombre del solicitante.
  observaciones: sdi.observaciones // Descripción de la solicitud.
})));
          setSdis(datos);
          setSdiError("");
        }
      })
      .catch(error => {
        if (vigente) setSdiError(error.message);
      })
      .finally(() => {
        if (vigente) setSdiLoading(false);
      });
    return () => { vigente = false; };
  }, [session, activeNav]); // Actualiza las SDI al cambiar de sección.
    // ETAPA 43.3 - Carga la actividad reciente al ingresar al Dashboard.
  useEffect(() => {
    if (!session) {
      setActividadReciente([]); // Limpia el historial al cerrar sesión.
      setActividadError("");
      setActividadLoading(false);
      return;
    }

    // Consulta únicamente cuando se visualiza el Dashboard.
    if (activeNav !== "Panel de control") return; // Consulta solo al visualizar el Dashboard.

    const token = sessionStorage.getItem("ancor.access");
    if (!token) {
      setActividadError("No se encontró el token de acceso.");
      return;
    }

    let vigente = true;
    setActividadLoading(true);
    setActividadError("");

    obtenerActividadReciente(token)
      .then(datos => {
        if (vigente) setActividadReciente(datos); // Movimientos reales de Django.
      })
      .catch(error => {
        if (vigente) {
          setActividadReciente([]);
          setActividadError(error.message);
        }
      })
      .finally(() => {
        if (vigente) setActividadLoading(false);
      });

    return () => { vigente = false; };
  }, [session, activeNav]);

  
  // ETAPA 17.18 - Cargar inspectores reales al ingresar a Equipo.
  useEffect(() => {
    // Limpiar los datos cuando no exista una sesión activa.
    if (!session) {
      setInspectores([]);
      return;
    }

    // Consultar únicamente cuando se abra la sección Equipo.
    if (activeNav !== "Equipo") return;

    const token = sessionStorage.getItem("ancor.access");
    if (!token) return;

    let vigente = true;
    setInspectoresLoading(true);

    // Obtener los inspectores registrados en Django.
    obtenerInspectores(token)
      .then(datos => {
        if (vigente) setInspectores(datos);
      })
      .catch(error => {
        if (vigente) notify(error.message);
      })
      .finally(() => {
        if (vigente) setInspectoresLoading(false);
      });

    // Evitar actualizar el estado después de salir de Equipo.
    return () => { vigente = false; };
  }, [session, activeNav]);


  // Persistencia exclusiva de información demostrativa.
  useEffect(() => { localStorage.setItem("ancor.demo.period.v1", JSON.stringify(period)); }, [period]);
  // Atajo Ctrl + K para buscar.
  useEffect(() => {
    const manejarTecla = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, []);

  
  // Estadísticas calculadas exclusivamente desde las SDI reales de Django.
  const sdiCounts = useMemo(() => ({
    total: sdis.length,                                                       // Total de solicitudes.
    pending: sdis.filter(s => s.estado === "pendiente").length,                // Pendientes de asignación.
    progress: sdis.filter(s => s.estado === "en_proceso").length,              // Inspecciones en ejecución.
    review: sdis.filter(s => s.estado === "pendiente_revision").length, // Estado oficial definido en Django.
    approved: sdis.filter(s => s.estado === "aprobada").length,                // Solicitudes aprobadas.
    closed: sdis.filter(s => s.estado === "cerrada").length,                  // Solicitudes cerradas.
    rejected: sdis.filter(s => s.estado === "rechazada").length,              // Solicitudes rechazadas.
    concession: sdis.filter(s => s.estado === "concesion").length,             // Solicitudes en concesión.
  }), [sdis]);

  


// PASO 45.20 - Buscar SDI por código, solicitante y otros campos.
const visibleSdis = useMemo(() => {
  // Ignora diferencias de mayúsculas, acentos y espacios exteriores.
  const normalizar = valor => String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return sdis.filter(sdi => {
    // Reunir los campos disponibles para la búsqueda.
    const texto = [
      sdi.codigo_sdi,
      sdi.solicitante,
      sdi.proyecto,
      sdi.observaciones,
      sdi.inspector_nombre,
      sdi.inspector_username,
      sdi.estado_nombre,
      sdi.estado
    ].map(normalizar).join(" ");

    // Buscar coincidencias parciales.
    const coincideBusqueda = texto.includes(normalizar(query));

    // Conservar los filtros existentes.
    const coincideEstado = filtroEstado === "todos" || sdi.estado === filtroEstado;
    const coincideOrigen = filtroOrigen === "todos" ||
      normalizar(sdi.departamento_solicitante) === normalizar(filtroOrigen);
    const coincideFecha = !filtroFecha ||
      String(sdi.fecha_emision || "").slice(0, 10) === filtroFecha;

    return coincideBusqueda && coincideEstado && coincideOrigen && coincideFecha;
  });
}, [sdis, query, filtroEstado, filtroOrigen, filtroFecha]);

// PASO 45.36.27.6 - Identificar las SDI de la página actual.
const sdisPagina = useMemo(() => {
  // Obtener únicamente las solicitudes de la página seleccionada.
  const inicio = (paginaSdi - 1) * registrosPorPagina;
  const fin = paginaSdi * registrosPorPagina;
  return visibleSdis.slice(inicio, fin);
}, [visibleSdis, paginaSdi]);

// PASO 45.36.27.7 - Consultar los resultados reales de calidad de las SDI visibles.
useEffect(() => {
  // Evitar consultas si no existe una sesión válida.
  const token = sessionStorage.getItem("ancor.access");
  if (!token || sdisPagina.length === 0) return;

  let activo = true; // Impedir actualizaciones después de desmontar el efecto.

  const cargarResultados = async () => {
    // Consultar en paralelo las inspecciones de las SDI de la página.
    const resultados = await Promise.all(sdisPagina.map(async sdi => {
      try {
        const resultado = await obtenerResultadoCalidadSDI(token, sdi.id);
        return [sdi.id, resultado];
      } catch (error) {
        console.error("Error consultando resultado de calidad:", sdi.id, error);
        return [sdi.id, "Sin determinar"];
      }
    }));

    // Guardar los resultados únicamente si la consulta sigue vigente.
    if (activo) {
      setResultadosCalidad(Object.fromEntries(resultados));
    }
  };

  cargarResultados();

  // Cancelar actualizaciones pendientes al cambiar de página o sesión.
  return () => { activo = false; };
}, [session, sdisPagina]);

 // Indicadores calculados desde las SDI reales del backend.
const periodCounts = {
  pending: sdiCounts.pending,
  progress: sdiCounts.progress,
  completed: sdiCounts.approved + sdiCounts.closed,
};

periodCounts.total = sdiCounts.total;
periodCounts.completion = periodCounts.total
  ? Math.round(periodCounts.completed / periodCounts.total * 100) : 0;
periodCounts.progressPercent = periodCounts.total
  ? Math.round(periodCounts.progress / periodCounts.total * 100) : 0;
periodCounts.pendingPercent = periodCounts.total
  ? Math.round(periodCounts.pending / periodCounts.total * 100) : 0;
  // Muestra notificaciones breves.
  const notify = message => {
    setToast(message);
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(""), 2800);
  };

  // Autenticación JWT real.
  const doLogin = async event => {
    event.preventDefault();
    if (loginLoading) return;
    const data = new FormData(event.currentTarget);
    setLoginError("");
    setLoginLoading(true);
    try {
      const tokens = await iniciarSesion(
        String(data.get("username") || "").trim(),
        String(data.get("password") || "")
      );
      const usuario = await obtenerUsuarioActual(tokens.access);
      if (!usuario.activo) throw new Error("Tu perfil está desactivado.");
      const nombre = [usuario.first_name, usuario.last_name].filter(Boolean).join(" ") || usuario.username;
      sessionStorage.setItem("ancor.access", tokens.access);
      sessionStorage.setItem("ancor.refresh", tokens.refresh);
      setSession({
        name: nombre,
        email: usuario.email || "",
        role: usuario.rol_nombre || usuario.rol,
        roleCode: usuario.rol,
      });
      setActiveNav("Panel de control");
      notify(`Bienvenido/a, ${nombre}.`);
    } catch (error) {
      sessionStorage.removeItem("ancor.access");
      sessionStorage.removeItem("ancor.refresh");
      setLoginError(error.message || "No se pudo iniciar sesión.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Cierra la sesión y elimina los tokens temporales.
  const doLogout = () => {
    sessionStorage.removeItem("ancor.access");
    sessionStorage.removeItem("ancor.refresh");
    localStorage.removeItem("ancor.demo.session.v1");
    setSession(null);
    setProfileOpen(false);
    setSelectedSdi(null);
    setShowNuevaSdi(false);
    setLoginError("");
  };

   // Abre el formulario únicamente para los roles autorizados.
  const abrirNuevaSdi = async () => {
    if (!puedeEditarSdi) return; // Impide abrir el formulario sin permisos.
    setNuevaSdiError("");
    setInspectores([]);
    setShowNuevaSdi(true);
    setInspectoresLoading(true);
    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("La sesión ha expirado.");
      const datos = await obtenerInspectores(token);
      // La API ya devuelve los inspectores disponibles para selección.
      setInspectores(Array.isArray(datos) ? datos : []);
    } catch (error) {
      setNuevaSdiError(error.message || "No se pudieron cargar los inspectores.");
    } finally {
      setInspectoresLoading(false);
    }
  };

  // Crea una SDI real; Django genera el código y estado inicial.
  const guardarNuevaSdi = async datosSDI => {
    if (guardandoSdi) return;
    setGuardandoSdi(true);
    setNuevaSdiError("");
    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("La sesión ha expirado.");
      const nueva = await crearSDI(token, datosSDI);

      // Actualización inmediata tras la confirmación del servidor.
      setSdis(actuales => [nueva, ...actuales.filter(s => s.id !== nueva.id)]);
      setShowNuevaSdi(false);
      setActiveNav("Solicitudes SDI");
      setQuery("");
      notify(`Solicitud ${nueva.codigo_sdi || "SDI"} creada correctamente.`);

      // Segunda consulta para sincronizar el listado completo.
      try {
        const actualizadas = await obtenerSDI(token);
        setSdis(actualizadas);
        setSdiError("");
      } catch (error) {
        setSdiError(`La SDI fue creada, pero no se pudo actualizar el listado: ${error.message}`);
      }
    } catch (error) {
      setNuevaSdiError(error.message || "No se pudo registrar la solicitud.");
    } finally {
      setGuardandoSdi(false);
    }
  };

  // Abre el formulario de edición y carga inspectores desde Django.
  const abrirEditarSdi = async sdi => {
    if (!puedeEditarSdi || sdi.estado === "cerrada") return;

    setEditarSdiError("");
    setInspectores([]);
    setSdiEnEdicion(sdi);
    setSelectedSdi(null);
    setInspectoresLoading(true);

    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("La sesión ha expirado.");

      const datos = await obtenerInspectores(token);
      setInspectores(Array.isArray(datos) ? datos : []);
    } catch (error) {
      setEditarSdiError(error.message || "No se pudieron cargar los inspectores.");
    } finally {
      setInspectoresLoading(false);
    }
  };

  // Guarda los cambios de una SDI real y sincroniza el listado.
  const guardarEdicionSdi = async datosActualizados => {
    if (!sdiEnEdicion || guardandoEdicion) return;

    setGuardandoEdicion(true);
    setEditarSdiError("");

    try {
      const actualizada = await editarSDI(sdiEnEdicion.id, datosActualizados);

      // Reflejar inmediatamente la respuesta confirmada por Django.
      setSdis(actuales => actuales.map(s =>
        s.id === actualizada.id ? actualizada : s
      ));
      setSdiEnEdicion(null);
      notify(`Solicitud ${actualizada.codigo_sdi} actualizada correctamente.`);

      // Volver a consultar PostgreSQL para mantener el listado sincronizado.
      try {
        const token = sessionStorage.getItem("ancor.access");
        const listado = await obtenerSDI(token);
        setSdis(listado);
        setSdiError("");
      } catch (error) {
        setSdiError(`La SDI fue actualizada, pero no se pudo recargar el listado: ${error.message}`);
      }
    } catch (error) {
      setEditarSdiError(error.message || "No se pudo editar la solicitud.");
    } finally {
      setGuardandoEdicion(false);
    }
  };
 
  // Registra un inspector real utilizando el backend Django.
  const inviteMember = async event => {
    event.preventDefault();

    // Obtener los datos ingresados en el formulario.
    const form = event.currentTarget;
    const datos = new FormData(form);

    const nuevoInspector = {
      username: String(datos.get("username") || "").trim(),
      password: String(datos.get("password") || ""),
      first_name: String(datos.get("first_name") || "").trim(),
      last_name: String(datos.get("last_name") || "").trim(),
      email: String(datos.get("email") || "").trim(),
    };

    try {
      // Utilizar la sesión JWT del usuario autenticado.
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Crear la cuenta y el perfil Inspector en Django.
      await crearInspector(token, nuevoInspector);
      // Actualizar la lista de inspectores después del registro.
      const inspectoresActualizados = await 
      obtenerInspectores(token);
      setInspectores(inspectoresActualizados);

      // Cerrar el formulario solo si Django confirma el registro.
      setShowInviteModal(false);
      notify("Inspector registrado correctamente.");
    } catch (error) {
      // Informar los errores sin cerrar el formulario.
      notify(error.message || "No se pudo registrar el inspector.");
    }
  };

  
  // ETAPA 17.24 - Cambiar el estado de un inspector en Django.
  const actualizarEstadoInspector = async (inspectorId, activo) => {
    try {
      // Obtener el token de la sesión actual.
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Actualizar el estado del inspector en PostgreSQL.
      const inspectorActualizado = await cambiarEstadoInspector(
        token, inspectorId, activo
      );

      // Actualizar la lista sin recargar la página.
      setInspectores(actuales =>
        actuales.map(inspector =>
          inspector.id === inspectorId
            ? inspectorActualizado
            : inspector
        )
      );

      notify(activo
        ? "Inspector activado correctamente."
        : "Inspector desactivado correctamente."
      );
    } catch (error) {
      // Mostrar cualquier error devuelto por Django.
      notify(error.message || "No se pudo actualizar el inspector.");
    }
  };



  // Estructura de navegación original.
  const nav = [
    {
      label: "GENERAL",
      links: [
        { name: "Panel de control", icon: "grid" },
        { name: "Solicitudes SDI", icon: "clipboard", count: String(sdis.length) },
        { name: "Inspecciones", icon: "check" },
        { name: "Trazabilidad", icon: "history" },
      ],
    },
    {
      label: "GESTIÓN",
      links: [
        { name: "Equipo", icon: "users" },
        { name: "Configuración", icon: "settings" },
      ],
    },
  ];

  // Tabla de SDI reales; las acciones de cambio de estado no se simulan.
  const sdiTable = (limit = Infinity) => (
    <div className="table-scroll">
      <table>
        {/* PASO 45.22 - Encabezados según el diseño aprobado de Gestión de SDI. */}
<thead>
  <tr>
    <th>N.º SDI</th>
    <th>ORIGEN</th>
    <th>SOLICITANTE</th>
    <th>FECHA INGRESO</th>
    <th>ESTADO</th>
    <th>RESULTADO</th>
    <th>INSPECTOR</th>
    <th>ACCIONES</th>
  </tr>
</thead>
        <tbody>
          
{visibleSdis
  .slice(
    limit === Infinity ? (paginaSdi - 1) * registrosPorPagina : 0, // Inicio de la página.
    limit === Infinity ? paginaSdi * registrosPorPagina : limit // Fin de la página o límite del Dashboard.
  )
  .map(sdi => (

            <tr key={sdi.id} onClick={() => setSelectedSdi(sdi)}>
              
{/* PASO 45.23 - Columnas de SDI según el diseño aprobado. */}
<td><strong>{sdi.codigo_sdi || "Sin código"}</strong></td>

{/* Muestra el origen con un formato legible sin modificar el dato original. */}
<td>
  {sdi.departamento_solicitante
    ? 
sdi.departamento_solicitante
  .split("_") // Separa los departamentos cuando existe un origen combinado.
  .map(origen => origen.charAt(0).toUpperCase() + origen.slice(1)) // Coloca la inicial en mayúscula.
  .join(" / ") // Presenta ambos departamentos de forma legible.

    : "Sin origen"}
</td>

<td>{sdi.solicitante || "Sin solicitante"}</td>

{/* PASO 45.32.10 - Mostrar la fecha en formato DD-MM-AAAA. */}
<td className="date-cell">
  {sdi.fecha_emision
    ? String(sdi.fecha_emision).slice(0, 10).split("-").reverse().join("-") // Cambia solo la presentación.
    : "—"}
</td>

{/* PASO 45.25 - Colores según el estado real de Django. */}
<td>
  <span className={`status ${
    sdi.estado === "pendiente" ? "status-pending" :
    sdi.estado === "en_proceso" ? "status-progress" :
    sdi.estado === "pendiente_revision" ? "status-review" :
    sdi.estado === "rechazada" ? "status-rejected" :
    ["aprobada", "cerrada"].includes(sdi.estado) ? "status-done" :
    sdi.estado === "concesion" ? "status-review" : ""
  }`}>
    <i/>{sdi.estado_nombre || sdi.estado}
  </span>
</td>
{/* PASO 45.36.22 - Columna independiente para el resultado de calidad. */}
<td>
  <span className="status">
    <i/>{resultadosCalidad[sdi.id] ?? "Consultando..."}
  </span>
</td>

{/* Columna del inspector asignado a la SDI. */}
<td>
  <div className="owner">
    {sdi.inspector_nombre || sdi.inspector_username || "Sin asignar"}
  </div>
</td>


{/* Acciones disponibles según los permisos y el estado de la SDI. */}
<td>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {/* Editar: disponible únicamente para usuarios autorizados y SDI no cerradas. */}
    {puedeEditarSdi && sdi.estado !== "cerrada" && (
      <button
        type="button"
        className="row-more"
        title="Editar SDI"
        aria-label={`Editar ${sdi.codigo_sdi}`}
        onClick={e => {
          e.stopPropagation(); // Evita abrir el detalle al editar.
          abrirEditarSdi(sdi); // Mantiene la función original.
        }}
      >
        <Icon name="edit" size={17}/>
      </button>
    )}

    {/* Ver detalle: disponible para consultar la solicitud. */}
    <button
      type="button"
      className="row-more"
      title="Ver detalle"
      aria-label={`Ver ${sdi.codigo_sdi}`}
      onClick={e => {
        e.stopPropagation(); // Evita ejecutar el evento de la fila.
        setSelectedSdi(sdi); // Abre el detalle de la SDI.
      }}
    >
      <Icon name="eye" size={17}/>
    </button>
  </div>
</td>



            </tr>
          ))}
        </tbody>
      </table>
      
        
{/* PASO 45.32.6 - Paginación visual según el mockup aprobado. */}
{limit === Infinity && visibleSdis.length > 0 && (
  <div className="sdi-pagination">
    {/* Cantidad de solicitudes visibles después de aplicar filtros. */}
    <span className="sdi-pagination-info">
      Mostrando {(paginaSdi - 1) * registrosPorPagina + 1}
      {" - "}{Math.min(paginaSdi * registrosPorPagina, visibleSdis.length)}
      {" de "}{visibleSdis.length} resultados
    </span>

    <div className="sdi-pagination-controls">
      {/* Retroceder una página. */}
      <button
        type="button"
        className="sdi-page-button"
        disabled={paginaSdi === 1}
        aria-label="Página anterior"
        onClick={() => setPaginaSdi(p => Math.max(1, p - 1))}
      >
        ‹
      </button>

      {/* Mostrar los números de página disponibles. */}
      {Array.from(
        { length: Math.ceil(visibleSdis.length / registrosPorPagina) },
        (_, i) => i + 1
      ).map(numero => (
        <button
          key={numero}
          type="button"
          className={`sdi-page-button ${paginaSdi === numero ? "active" : ""}`}
          aria-label={`Página ${numero}`}
          aria-current={paginaSdi === numero ? "page" : undefined}
          onClick={() => setPaginaSdi(numero)}
        >
          {numero}
        </button>
      ))}

      {/* Avanzar una página sin superar el total disponible. */}
      <button
        type="button"
        className="sdi-page-button"
        disabled={paginaSdi >= Math.ceil(visibleSdis.length / registrosPorPagina)}
        aria-label="Página siguiente"
        onClick={() => setPaginaSdi(p =>
          Math.min(Math.ceil(visibleSdis.length / registrosPorPagina), p + 1)
        )}
      >
        ›
      </button>
    </div>
  </div>
)}

      {!sdiLoading && !sdiError && visibleSdis.length === 0 && (
        <div className="empty-state">No hay solicitudes SDI para mostrar.</div>
      )}
    </div>
  );

  // Sección reutilizable de solicitudes reales.
  const sdiSection = (
    <div className="card activity-card full-list-card">
      {sdiLoading && <p>Cargando solicitudes...</p>}
      {sdiError && <p role="alert" style={{ color: "#b42318" }}>{sdiError}</p>}
      {!sdiLoading && sdiTable()}
    </div>
  );

// Dashboard: solicitudes e indicadores calculados desde Django.
  const dashboard = (
    <>
      <section className="welcome-row">
         {/* Encabezado del Dashboard según el mockup 2. */}
          <div>
            <h1>Dashboard</h1>
            <p>Resumen general del sistema SDI</p>
        </div>
        <div className="welcome-actions">
          <button className="button button-outline" onClick={() => setActiveNav("Solicitudes SDI")}>
            <Icon name="clipboard" size={17}/> Consultar solicitudes
          </button>
          {/* Solo los roles autorizados pueden crear solicitudes SDI. */}
          {puedeEditarSdi && (
            <button className="button button-primary" onClick={abrirNuevaSdi}>
              <Icon name="plus" size={18}/> Nueva SDI
            </button>
          )}
        </div>
      </section>

      
      {/* Cinco indicadores del Dashboard según el mockup aprobado. */}
      <section className="metric-grid dashboard-metrics" aria-label="Indicadores de SDI">
        <Metric label="Total SDI" value={sdiCounts.total} change="" note="Ver detalles" icon="clipboard" tone="blue"/>
        <Metric label="Pendientes" value={sdiCounts.pending} change="" note="Ver detalles" icon="calendar" tone="amber"/>
        <Metric label="En proceso" value={sdiCounts.progress} change="" note="Ver detalles" icon="settings" tone="violet"/>
        <Metric label="Pendientes de revisión" value={sdiCounts.review} change="" note="Ver detalles" icon="eye" tone="amber"/>
        <Metric label="Cerradas" value={sdiCounts.closed} change="" note="Ver detalles" icon="check" tone="green"/>
      </section>

            {/* Resumen visual de los estados registrados en Django. */}
      <section className="dashboard-summary">
        <div className="card completion-card">
          <div className="card-heading">
            <div>
              <h2>Estado de solicitudes</h2>
              <p>Resumen general de las SDI registradas</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setActiveNav("Solicitudes SDI")}
              aria-label="Ver solicitudes SDI"
            >
              <Icon name="more"/>
            </button>
            </div> {/* Cierra el encabezado de la tarjeta. */}
          <div className="donut-area">
            <div className="donut" style={{
              background: `conic-gradient(#267ab5 0 ${periodCounts.completion}%, #9080d3 ${periodCounts.completion}% ${periodCounts.completion + periodCounts.progressPercent}%, #e5eaf0 ${periodCounts.completion + periodCounts.progressPercent}% 100%)`,
            }}>
              <div><strong>{periodCounts.total}</strong><span>Total</span></div>
            </div>
            <div className="donut-center-label">
              <span><i className="dot-blue"/>Completadas <b>{periodCounts.completion}%</b></span>
              <span><i className="dot-violet"/>En proceso <b>{periodCounts.progressPercent}%</b></span>
              <span><i className="dot-gray"/>Pendientes <b>{periodCounts.pendingPercent}%</b></span>
            </div>
          </div>
          <div className="completion-foot">
            <span className="tiny-check">✓</span>
            <span><b>Control de calidad</b><small>Indicadores obtenidos de la SDI registradas.</small></span>
          </div>
        </div>
                {/* ETAPA 43.3 - Movimientos reales registrados en el historial de Django. */}
        <div className="card activity-card dashboard-activity-card">
          <div className="card-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p>Últimos movimientos registrados en las SDI</p>
            </div>
            <Icon name="history" size={20}/>
          </div>

          {actividadLoading && <p>Cargando actividad reciente...</p>}

          {actividadError && (
            <p role="alert" style={{ color: "#b42318" }}>
              {actividadError}
            </p>
          )}

          {!actividadLoading && !actividadError && actividadReciente.length === 0 && (
            <div className="empty-state">No hay actividad reciente.</div>
          )}

          {!actividadLoading && !actividadError && actividadReciente.length > 0 && (
            <div className="dashboard-activity-list">
              {actividadReciente.map(movimiento => (
                <div className="dashboard-activity-item" key={movimiento.id}>
                  <span className="dashboard-activity-icon">
                    <Icon name="history" size={17}/>
                  </span>

                  <div className="dashboard-activity-content">
                    <strong>{movimiento.accion}</strong>

                    <p>
                      SDI #{movimiento.sdi}
                      {movimiento.usuario_username
                        ? ` · ${movimiento.usuario_username}`
                        : " · Usuario no disponible"}
                    </p>

                    {movimiento.comentario && (
                      <p>{movimiento.comentario}</p>
                    )}

                    <small>
                      {movimiento.fecha
                        ? new Date(movimiento.fecha).toLocaleString("es-CL")
                        : "Fecha no disponible"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );

  // ============================================================
  // PANTALLAS DE NAVEGACIÓN
  // ============================================================
  const genericView = () => {
    // ETAPA 43.5 - Mostrar las inspecciones recuperadas desde Django.
if (activeNav === "Inspecciones") {
  return (
    <>
      <section className="welcome-row">
        <div>
          <h1>Mis inspecciones</h1>
          <p>Solicitudes de inspección asignadas desde Control de Calidad.</p>
        </div>
      </section>

      {sdiLoading && <p>Cargando inspecciones...</p>}
      {sdiError && <p role="alert">{sdiError}</p>}

      {!sdiLoading && !sdiError && (
        <div className="card activity-card full-list-card">
          {sdiTable()}
        </div>
      )}
    </>
  );
}
    // Pantalla de SDI reales con botón de creación.
    if (activeNav === "Solicitudes SDI") {
      return (
        <>
          <section className="welcome-row">
            

{/* PASO 45.32.8 - Encabezado con icono según mockup aprobado. */}
<div className="sdi-page-heading">
  {/* Icono azul de Gestión de SDI. */}
  <div className="sdi-page-heading-icon">
    <Icon name="clipboard" size={23}/>
  </div>

  {/* Título y descripción de la pantalla. */}
  <div className="sdi-page-heading-text">
    <h1>Gestión de SDI</h1>
    <p>Consulta, asigna inspectores y realiza seguimiento.</p>
  </div>
</div>


            <div className="welcome-actions">
              {/* Oculta la creación de SDI a los inspectores. */}
              {puedeEditarSdi && (
                <button className="button button-primary" onClick={abrirNuevaSdi}>
                  <Icon name="plus" size={18}/> Nueva SDI
                </button>
              )}
            </div>
                   </section>

         
  
{/* PASO 45.14 - Barra de búsqueda integrada a los filtros de SDI. */}
<div className="sdi-filters">
  {/* Buscar solicitudes mediante el estado query existente. */}
  <label className="sdi-filter-field sdi-filter-search">
    Buscar solicitud
    <div className="sdi-search-input">
      <Icon name="search" size={18}/>
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar por número, solicitante o descripción..."
        aria-label="Buscar solicitudes SDI"
      />
    </div>
  </label>

  {/* Filtrar por el estado oficial registrado en Django. */}
  <label className="sdi-filter-field">
    Estado
    <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
      <option value="todos">Todos los estados</option>
      <option value="pendiente">Pendiente</option>
      <option value="en_proceso">En proceso</option>
      <option value="pendiente_revision">Pendiente de revisión</option>
      <option value="aprobada">Aprobada</option>
      <option value="rechazada">Rechazada</option>
      <option value="concesion">Concesión</option>
      <option value="cerrada">Cerrada</option>
    </select>
  </label>

            {/* PASO 45.13 - Filtrar cada origen de forma independiente. */}
<label className="sdi-filter-field">
  Origen
  <select value={filtroOrigen} onChange={e => setFiltroOrigen(e.target.value)}>
    <option value="todos">Todos los orígenes</option>
    <option value="Producción">Producción</option>
    <option value="Bodega">Bodega</option>
    <option value="Calidad">Calidad</option>
  </select>
</label>

            {/* Filtrar por fecha de emisión registrada. */}
            <label className="sdi-filter-field">
              Fecha de emisión
              <input type="date" value={filtroFecha}
                onChange={e => setFiltroFecha(e.target.value)}/>
            </label>

            
{/* PASO 45.32.9 - Botón de filtros según el mockup aprobado. */}
<button
  type="button"
  className="sdi-filter-icon-button"
  title="Limpiar filtros"
  aria-label="Limpiar filtros"
  onClick={() => {
    setFiltroEstado("todos"); // Restablece el estado.
    setFiltroOrigen("todos"); // Restablece el origen.
    setFiltroFecha(""); // Limpia la fecha seleccionada.
    setQuery(""); // Limpia la búsqueda.
  }}
>
  <Icon name="filter" size={19}/>
</button>

          </div>

          {sdiSection}
        </>
      );
    }
    // ETAPA 17.19 - Administración de inspectores reales.
    if (activeNav === "Equipo") {
      // Solo estos roles pueden registrar inspectores.
      const puedeRegistrar = [
        "administrador", "jefe_calidad", "supervisor"
      ].includes(session?.roleCode);

      return (
        <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="live-dot"/> PERSONAL DE CALIDAD
              </div>
              <h1>Equipo</h1>
              <p>Inspectores registrados en el sistema ANCOR TECMIN.</p>
            </div>

            {/* Mostrar el registro únicamente a roles autorizados. */}
            {puedeRegistrar && (
              <button className="button button-primary"
                onClick={() => setShowInviteModal(true)}>
                + Registrar inspector
              </button>
            )}
          </section>

          {/* Mostrar el estado de la consulta a Django. */}
          {inspectoresLoading ? (
            <div className="empty-state">Cargando inspectores...</div>
          ) : inspectores.length === 0 ? (
            <div className="empty-state">
              No hay inspectores disponibles.
            </div>
          ) : (
            <div className="team-grid">
              {inspectores.map(person => {
                // Construir el nombre mostrado en la tarjeta.
                const nombre = [person.first_name, person.last_name]
                  .filter(Boolean).join(" ") || person.username;

                const iniciales = nombre.split(/\s+/)
                  .map(parte => parte[0])
                  .slice(0, 2).join("").toUpperCase();

                return (
                  <div className="card team-card" key={person.id}>
                    <div className="avatar blue">{iniciales}</div>
                    <div>
                      <strong>{nombre}</strong>
                      <span>Inspector de calidad</span>
                      <small>{person.email || person.username}</small>
                    </div>
                    
                    {/* Mostrar el estado real del inspector en Django. */}
                    <div className="team-inspector-actions">
                      <span className={`team-active ${person.activo ? "" : "team-invited"}`}>
           <i/> {person.activo ? "Activo" : "Inactivo"}
  </span>

  {/* Solo los roles autorizados pueden cambiar el estado. */}
  {puedeRegistrar && (
    <button
      type="button"
      className="button button-outline"
      onClick={() => actualizarEstadoInspector(person.id, !person.activo)}
    >
      {person.activo ? "Desactivar" : "Activar"}
    </button>
  )}
</div>

                  </div>
                );
              })}
            </div>
          )}
        </>
      );
    }


    // Guía rápida.
    if (activeNav === "Ayuda") {
      return (
        <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot"/> GUÍA RÁPIDA</div>
              <h1>Ayuda</h1>
              <p>Cómo utilizar esta versión de Control de Calidad.</p>
            </div>
          </section>
          <div className="card help-page">
            <h2>Solicitudes SDI</h2>
            <p>Consulta las solicitudes reales o utiliza Nueva SDI para registrar una solicitud en Django.</p>
            <h2>Inspectores</h2>
            <p>Los inspectores disponibles se obtienen del backend al abrir el formulario.</p>
            <h2>Actividades e inspecciones</h2>
            <p>Estas secciones todavía utilizan datos locales de demostración.</p>
            <h2>Acceso</h2>
            <p>Inicia sesión con un usuario registrado en Django.</p>
          </div>
        </>
      );
    }
  }
  // Esperar mientras Django verifica el token JWT guardado.
if (verificandoSesion) {
  return (
    <main className="login-page">
      <div className="login-card">
        <p>Verificando sesión...</p>
      </div>
    </main>
  );
}

// Mostrar el login solamente cuando no exista una sesión válida.
if (!session) {
  return <Login onLogin={doLogin} error={loginError} loading={loginLoading}/>;
}

  // ============================================================
  // RENDER PRINCIPAL: SIDEBAR, DASHBOARD Y MODALES
  // ============================================================
  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="brand">
          <img src={logoAncor} alt="Ancor Tecmin" className="brand-logo"/>
          <button className="collapse" aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            onClick={() => setCollapsed(v => !v)}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-icon">AC</div>
          <div className="workspace-copy">
            <span>Espacio de trabajo</span><strong>Control de Calidad</strong>
          </div>
          <span className="chevron">⌄</span>
        </div>

        <nav>
          {nav.map(group => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.links.map(link => (
                <button key={link.name}
                  className={`nav-link ${activeNav === link.name ? "active" : ""}`}
                  onClick={() => { setActiveNav(link.name); setProfileOpen(false); }}>
                  <Icon name={link.icon}/>
                  <span>{link.name}</span>
                  {link.count && <small className="nav-count">{link.count}</small>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>¿Necesitas ayuda?</strong>
            <span>Revisa la guía rápida para comenzar.</span>
            <button onClick={() => setActiveNav("Ayuda")}>
              Ver guía <Icon name="arrow" size={15}/>
            </button>
          </div>
          <div className="profile">
            <div className="avatar avatar-navy">
              {session.name.split(" ").map(p => p[0]).slice(0, 2).join("")}
            </div>
            <div className="profile-copy">
              <strong>{session.name}</strong><span>{session.role}</span>
            </div>
            <button className="icon-button" aria-label="Opciones de perfil"
              onClick={() => setProfileOpen(v => !v)}>
              <Icon name="more"/>
            </button>
            {profileOpen && (
              <div className="popover profile-popover">
                <strong>{session.name}</strong><span>{session.email}</span>
                <button onClick={() => notify(`Usuario: ${session.name} · Rol: ${session.role}`)}>
                  Mi perfil
                </button>
                <button className="logout-action" onClick={doLogout}>
                  <Icon name="logout" size={16}/> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-area">
        
{/* PASO 45.32.15.4 - Barra superior según el mockup aprobado. */}
<header className="topbar">
  {/* Botón para expandir o contraer la barra lateral. */}
  <div className="topbar-left">
    <button
      type="button"
      className="topbar-menu-button"
      aria-label="Expandir o contraer menú"
      onClick={() => setCollapsed(v => !v)}
    >
      <Icon name="menu" size={21}/>
    </button>
    <span className="topbar-section-name">Control de Calidad</span>
  </div>

  {/* Notificaciones y datos del usuario autenticado. */}
  <div className="top-actions">
    <div className="topbar-notifications">
      <button
        type="button"
        className="topbar-bell-button"
        aria-label="Notificaciones"
        aria-expanded={notificationOpen}
        onClick={() => setNotificationOpen(v => !v)}
      >
        <Icon name="bell" size={20}/>
      </button>

      {/* No se muestran notificaciones ficticias. */}
      {notificationOpen && (
        <div className="topbar-notification-panel">
          <strong>Notificaciones</strong>
          <p>No hay notificaciones disponibles.</p>
        </div>
      )}
    </div>

    {/* Avatar con las iniciales reales del usuario. */}
    <button
      type="button"
      className="avatar avatar-navy top-avatar profile-trigger"
      aria-label="Abrir opciones del perfil"
      aria-expanded={profileOpen}
      onClick={() => setProfileOpen(v => !v)}
    >
      {session.name.split(" ").map(p => p[0]).slice(0, 2).join("")}
    </button>

    {/* Nombre y rol obtenidos de la sesión. */}
    <div className="topbar-user-info">
      <strong>{session.name}</strong>
      <span>{session.role}</span>
    </div>

    
{/* PASO 45.32.15.6 - Menú desplegable del perfil superior. */}
{profileOpen && (
  <div className="popover top-profile-menu">
    {/* Datos reales del usuario autenticado. */}
    <strong>{session.name}</strong>
    <span>{session.email}</span>

    {/* Muestra la información del perfil existente. */}
    <button
      type="button"
      onClick={() => {
        notify(`Usuario: ${session.name} · Rol: ${session.role}`);
        setProfileOpen(false);
      }}
    >
      <Icon name="user" size={16}/> Mi perfil
    </button>

    {/* Ejecuta el cierre de sesión real. */}
    <button
      type="button"
      className="logout-action"
      onClick={doLogout}
    >
      <Icon name="logout" size={16}/> Cerrar sesión
    </button>
  </div>
)}

  </div>
</header>

        <div className="page-content">
          {activeNav === "Panel de control" ? dashboard : genericView()}
          <footer className="page-footer">
            <span>© 2026 Ancor Tecmin · Control de Calidad</span>
            <span><i/> SDI reales en Django · Otras secciones demostrativas</span>
          </footer>
        </div>
      </main>
      {/* Modal de invitaciones locales. */}
      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} onSubmit={inviteMember}/>
      )}

      {/* Modal de creación real de solicitudes SDI. */}
      {showNuevaSdi && (
        <NuevaSDIModal
          inspectores={inspectores}
          cargandoInspectores={inspectoresLoading}
          guardando={guardandoSdi}
          error={nuevaSdiError}
          onSubmit={guardarNuevaSdi}
          onClose={() => { if (!guardandoSdi) setShowNuevaSdi(false); }}
        />
      )}
{/* Formulario real de edición de solicitudes SDI. */}
{sdiEnEdicion && (
  <EditarSDIModal
    key={sdiEnEdicion.id}
    sdi={sdiEnEdicion}
    inspectores={inspectores}
    cargandoInspectores={inspectoresLoading}
    guardando={guardandoEdicion}
    error={editarSdiError}
    onSubmit={guardarEdicionSdi}
    onClose={() => {
      if (!guardandoEdicion) setSdiEnEdicion(null);
    }}
  />
)}
      {/* Detalle de una SDI con permisos según el rol autenticado. */}
      
        {/* ETAPA 42.7 - Detalle SDI con permisos y actualización del estado. */}
{selectedSdi && (
  <SdiDetailModal
    sdi={selectedSdi}
    puedeRegistrarItems={puedeEditarSdi}
    esInspector={session?.roleCode === "inspector"}
    onSdiIniciada={actualizarSdiIniciada}
    onClose={() => setSelectedSdi(null)}
  />
)}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}
// ============================================================
// COMPONENTES SECUNDARIOS
// ============================================================

// Pantalla de autenticación conectada a Django.

function Login({ onLogin, error, loading }) {
  const [mostrarPassword, setMostrarPassword] = React.useState(false); // Controla la visibilidad de la contraseña.

  return (
    <main className="login-page">
      <section className="login-layout">
        {/* Panel institucional izquierdo. */}
        <aside className="login-visual">
          <img src={logoAncor} alt="ANCOR TECMIN" className="login-logo"/>
          <div className="login-visual-copy">
            <h2>Control de Calidad</h2>
            <p>Sistema de Gestión de SDI</p>
          </div>
          <div className="login-values">
  {/* Indicadores institucionales del sistema. */}
  <div><Icon name="shield" size={32}/><strong>Trazabilidad</strong></div>
  <div><Icon name="settings" size={32}/><strong>Calidad</strong></div>
  <div><Icon name="chartUp" size={32}/><strong>Mejora continua</strong></div>
</div>
        </aside>

        {/* Formulario conectado a la autenticación existente de Django. */}
        <section className="login-form-panel">
          <div className="login-kicker">CONTROL DE CALIDAD</div>
          <h1>Bienvenido/a</h1>
          <p className="login-description">Ingresa con tu cuenta de ANCOR TECMIN.</p>

          <form onSubmit={onLogin}>
            <label htmlFor="login-username">Usuario</label>
            <div className="login-input-wrap">
              <Icon name="user" size={18}/> {/* Identifica el campo de usuario. */}
              <input id="login-username" name="username" autoComplete="username"
                placeholder="Usuario registrado en Django" required/>
            </div>

            <label htmlFor="login-password">Contraseña</label>
            <div className="login-input-wrap">
              <Icon name="lock" size={18}/> {/* Identifica el campo de contraseña. */}
              <input id="login-password" name="password"
                type={mostrarPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña" required/>
              <button type="button" className="login-eye"
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setMostrarPassword(!mostrarPassword)}>
                {/* Cambia el icono según la visibilidad de la contraseña. */}
                {mostrarPassword
                ? <Icon name="eyeOff" size={18}/>
                : <Icon name="eye" size={18}/>}
              </button>
            </div>

            {error && <p role="alert" className="login-error">{error}</p>}
            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? "Verificando..." : "Iniciar sesión"} <span aria-hidden="true">→</span>
            </button>
          </form>

          <small className="login-note">
            Acceso exclusivo para usuarios registrados en ANCOR TECMIN.
          </small>
        </section>
      </section>
    </main>
  );
}

// ETAPA 18.3 - Consultar los productos reales asociados a una SDI.
function SdiDetailModal({ sdi, puedeRegistrarItems, esInspector, onSdiIniciada, onClose }) {
  // Solo los roles administrativos pueden cerrar una SDI.
  const puedeCerrarSDI = puedeRegistrarItems && !esInspector;
  // Estados para almacenar productos, carga y errores.
  const [itemsSDI, setItemsSDI] = useState([]);
  // ETAPA 25.1 - Controla la pestaña activa del detalle SDI.
  const [pestanaActiva, setPestanaActiva] = useState("productos");
  // PASO 45.35.8 - Almacenar inspecciones reales agrupadas por producto.
  const [inspeccionesSDI, setInspeccionesSDI] = useState([]); // Historial de inspecciones.
  const [cargandoInspeccionesSDI, setCargandoInspeccionesSDI] = useState(false); // Estado de carga.
  const [errorInspeccionesSDI, setErrorInspeccionesSDI] = useState(""); // Errores de consulta.
  const [cargandoItems, setCargandoItems] = useState(true);
  const [errorItems, setErrorItems] = useState("");
  // PASO 45.36.15 - Determinar el resultado de calidad usando inspecciones reales.
const resultadoCalidadSDI = (() => {
  // Esperar a que terminen las consultas de productos e inspecciones.
  if (cargandoItems || cargandoInspeccionesSDI) return "Consultando...";

  // No mostrar resultados incorrectos cuando exista un error de consulta.
  if (errorItems || errorInspeccionesSDI) return "Sin determinar";

  // Una SDI sin productos o sin inspecciones todavía no tiene resultado.
  if (itemsSDI.length === 0) return "Sin evaluar";
  if (inspeccionesSDI.some(grupo => grupo.inspecciones.length === 0)) {
    return "Sin determinar";
  }

  // Obtener la última inspección de cada producto según su número de intento.
  const ultimas = inspeccionesSDI.map(({ inspecciones }) =>
    [...inspecciones].sort(
      (a, b) => Number(b.numero_inspeccion) - Number(a.numero_inspeccion)
    )[0]
  );

  // Evitar resultados definitivos mientras existan inspecciones en proceso.
  if (ultimas.some(inspeccion => inspeccion.resultado === "en_proceso")) {
    return "En evaluación";
  }

  // Normalizar los resultados oficiales recibidos desde Django.
  const resultados = ultimas.map(inspeccion =>
    String(inspeccion.resultado || "").toLowerCase()
  );

  // Mostrar aprobación solamente si todos los productos están aprobados.
  if (resultados.every(resultado => resultado === "aprobada")) {
    return "Aprobada";
  }

  // Mostrar rechazo cuando todos los productos estén rechazados.
  if (resultados.every(resultado => resultado === "rechazada")) {
    return "Rechazada";
  }

  // Mostrar resultado parcial cuando Django registre expresamente ese resultado.
  if (resultados.every(resultado =>
    ["aprobada", "rechazada", "parcial"].includes(resultado)
  )) {
    return "Parcial";
  }

  // Concesiones y otros estados requieren una resolución confirmada.
  return "Sin determinar";
})();
  // ETAPA 18.4 - Datos del formulario para registrar productos.
  const [nuevoItem, setNuevoItem] = useState({
    articulo: "",
    codigo_plano: "",
    cantidad_a_inspeccionar: "",
    observaciones: "",
  });

  // Controlar el guardado y los mensajes del formulario.
  const [guardandoItem, setGuardandoItem] = useState(false);
  const [errorGuardarItem, setErrorGuardarItem] = useState("");
  const [exitoGuardarItem, setExitoGuardarItem] = useState("");
  // ETAPA 21.2 - Control del inicio de inspecciones reales.
  const [itemEnInspeccion, setItemEnInspeccion] = useState(null);
  const [cantidadInspeccion, setCantidadInspeccion] = useState("");
  const [observacionInspeccion, setObservacionInspeccion] = useState("");
  const [iniciandoInspeccion, setIniciandoInspeccion] = useState(false);
  const [errorInspeccion, setErrorInspeccion] = useState("");
  // ETAPA 21.3 - Conserva la inspección creada para registrar su evaluación visual.
  const [inspeccionActual, setInspeccionActual] = useState(null);
  // ETAPA 21.3 - Criterios de evaluación visual definidos en Django.
  const [criteriosVisuales, setCriteriosVisuales] = useState({
    rebarbas: "",
    rayaduras: "",
    golpes: "",
    deformidad: "",
    pintura: "",
    burbujas: "",
    planitud: "",
  });

// Observaciones de la evaluación visual.
const [observacionesVisuales, setObservacionesVisuales] = useState("");

  // ETAPA 22 - Estados para gestionar evidencias fotográficas.
  const [archivoEvidencia, setArchivoEvidencia] = useState(null);
  const [descripcionEvidencia, setDescripcionEvidencia] = useState("");
  const [evidencias, setEvidencias] = useState([]);
  // ETAPA 24.4 - Evaluación visual recuperada desde Django.
  const [evaluacionVisualConsulta, setEvaluacionVisualConsulta] = useState(null);
  const [subiendoEvidencia, setSubiendoEvidencia] = useState(false);
  const [errorEvidencia, setErrorEvidencia] = useState("");
  const [exitoEvidencia, setExitoEvidencia] = useState("");
  // ETAPA 23 - Controlar la finalización de la inspección.
  const [cantidadAprobada, setCantidadAprobada] = useState("");
  const [finalizandoInspeccion, setFinalizandoInspeccion] = useState(false);
  const [errorFinalizacion, setErrorFinalizacion] = useState("");
  const [exitoFinalizacion, setExitoFinalizacion] = useState("");
  // ETAPA 42.7 - Control del inicio formal de la SDI.
  const [iniciandoSDI, setIniciandoSDI] = useState(false);
  const [errorInicioSDI, setErrorInicioSDI] = useState("");
  // ETAPA 42.9.39 - Control de la finalización formal de la SDI.
  const [finalizandoSDI, setFinalizandoSDI] = useState(false);
  const [errorTerminarSDI, setErrorTerminarSDI] = useState("");
  const [exitoTerminarSDI, setExitoTerminarSDI] = useState("");
    // ETAPA 42.9.58 - Control del cierre administrativo.
  const [cerrandoSDI, setCerrandoSDI] = useState(false);
  const [errorCerrarSDI, setErrorCerrarSDI] = useState("");
  const [exitoCerrarSDI, setExitoCerrarSDI] = useState("");

  // Iniciar la SDI asignada mediante Django.
  const confirmarInicioSDI = async () => {
    if (iniciandoSDI || !esInspector || sdi.estado !== "pendiente") return;

    setIniciandoSDI(true);
    setErrorInicioSDI("");

    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Django valida la asignación y registra el inicio formal.
      await iniciarSDI(token, sdi.id);

      // Consultar el estado actualizado desde el backend.
      const actualizadas = await obtenerSDI(token);
      const confirmada = actualizadas.find(item => item.id === sdi.id);

      if (!confirmada) {
        throw new Error("La SDI se inició, pero no se pudo recuperar su estado.");
      }

      // Actualizar el detalle y el listado principal.
      await onSdiIniciada(confirmada);
    } catch (error) {
      setErrorInicioSDI(error.message || "No se pudo iniciar la SDI.");
    } finally {
      setIniciandoSDI(false);
    }
  };
    // ETAPA 42.9.45 - Enviar la SDI a revisión administrativa.
  const confirmarTerminoSDI = async () => {
    if (finalizandoSDI || !esInspector || sdi.estado !== "en_proceso") return;

    setFinalizandoSDI(true);
    setErrorTerminarSDI("");
    setExitoTerminarSDI("");

    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Solicitar a Django la finalización formal de la SDI.
      await terminarSDI(token, sdi.id);

      // Recuperar el estado actualizado desde PostgreSQL.
      const actualizadas = await obtenerSDI(token);
      const confirmada = actualizadas.find(item => item.id === sdi.id);

      if (!confirmada) {
        throw new Error("La SDI se finalizó, pero no se pudo recuperar su estado.");
      }

      // Actualizar el modal y el listado principal.
      await onSdiIniciada(confirmada);
      setExitoTerminarSDI("SDI enviada correctamente a revisión.");
    } catch (error) {
      setErrorTerminarSDI(error.message || "No se pudo finalizar la SDI.");
    } finally {
      setFinalizandoSDI(false);
    }
  };
    // ETAPA 42.9.58 - Cierre administrativo de una SDI revisada.
  const confirmarCierreSDI = async () => {
    if (cerrandoSDI || !puedeCerrarSDI || sdi.estado !== "pendiente_revision") return; // Valida el estado oficial de Django.

    // Confirmar la operación antes de modificar el estado.
    if (!window.confirm("¿Confirmas el cierre administrativo de esta SDI?")) return;

    setCerrandoSDI(true);
    setErrorCerrarSDI("");
    setExitoCerrarSDI("");

    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Solicitar a Django el cierre administrativo.
      await cerrarSDI(token, sdi.id);

      // Recuperar el estado definitivo desde PostgreSQL.
      const actualizadas = await obtenerSDI(token);
      const confirmada = actualizadas.find(item => item.id === sdi.id);

      if (!confirmada) {
        throw new Error("La SDI se cerró, pero no se pudo recuperar su estado.");
      }

      // Actualizar el detalle y el listado principal.
      await onSdiIniciada(confirmada);
      setExitoCerrarSDI("La SDI se cerró correctamente.");
    } catch (error) {
      setErrorCerrarSDI(error.message || "No se pudo cerrar la SDI.");
    } finally {
      setCerrandoSDI(false);
    }
  };
  // Consultar Django al abrir el detalle de la SDI.
  useEffect(() => {
    let vigente = true; // Evitar actualizaciones después de cerrar.

    const cargarItems = async () => {
      setCargandoItems(true);
      setErrorItems("");

      try {
        const token = sessionStorage.getItem("ancor.access"); // Obtener JWT.
        if (!token) throw new Error("Tu sesión ha expirado.");

        const productos = await obtenerItemsSDI(token, sdi.id); // Consultar API.
        if (vigente) setItemsSDI(productos);
      } catch (error) {
        if (vigente) setErrorItems(error.message); // Registrar error.
      } finally {
        if (vigente) setCargandoItems(false); // Finalizar consulta.
      }
    };

    cargarItems();

    return () => { vigente = false; }; // Limpiar efecto.
  }, [sdi.id]);
  // PASO 45.35.9 - Consultar las inspecciones reales al abrir la pestaña Inspección.
useEffect(() => {
  // PASO 45.36.4 - Consultar inspecciones al abrir el detalle de la SDI.
if (cargandoItems || errorItems) return; // Esperar los productos antes de consultar.

  let vigente = true; // Evita actualizar estados después de cerrar o cambiar de pestaña.

  const cargarInspeccionesSDI = async () => {
    setCargandoInspeccionesSDI(true); // Mostrar indicador de carga.
    setErrorInspeccionesSDI(""); // Limpiar errores anteriores.

    try {
      const token = sessionStorage.getItem("ancor.access"); // Obtener JWT.
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Consultar todas las inspecciones de cada producto de la SDI.
      const resultados = await Promise.all(
        itemsSDI.map(async (item) => ({
          item,
          inspecciones: await obtenerInspeccionesItem(token, item.id),
        }))
      );

      if (vigente) setInspeccionesSDI(resultados); // Conservar inspecciones por producto.
    } catch (error) {
      if (vigente) {
        setInspeccionesSDI([]); // Evitar mostrar datos anteriores.
        setErrorInspeccionesSDI(error.message || "No se pudieron cargar las inspecciones.");
      }
    } finally {
      if (vigente) setCargandoInspeccionesSDI(false); // Finalizar la carga.
    }
  };

  cargarInspeccionesSDI();

  return () => { vigente = false; }; // Cancelar actualizaciones obsoletas.
}, [itemsSDI, cargandoItems, errorItems]); // Actualizar cuando cambien los productos.
    // ETAPA 18.4 - Actualizar los datos del formulario.
  const cambiarCampoItem = (campo, valor) => {
    setNuevoItem(anterior => ({ ...anterior, [campo]: valor }));
  };

  // ETAPA 18.4 - Registrar el producto mediante la API de Django.
  const guardarNuevoItem = async (e) => {
    e.preventDefault(); // Evitar que el formulario recargue la página.
    if (guardandoItem) return; // Impedir envíos duplicados.

    setErrorGuardarItem("");
    setExitoGuardarItem("");

    // Validar los datos antes de enviarlos.
    const cantidad = Number(nuevoItem.cantidad_a_inspeccionar);

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setErrorGuardarItem("Las unidades a inspeccionar deben ser mayores que cero.");
      return;
    }

    if (!nuevoItem.articulo.trim()) {
      setErrorGuardarItem("Debes ingresar el nombre del artículo.");
      return;
    }

    setGuardandoItem(true);

    try {
      const token = sessionStorage.getItem("ancor.access"); // Obtener JWT.
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Preparar los datos que espera el serializer de Django.
      const datosItem = {
        articulo: nuevoItem.articulo.trim(),
        codigo_plano: nuevoItem.codigo_plano.trim(),
        cantidad_a_inspeccionar: cantidad,
        observaciones: nuevoItem.observaciones.trim(),
      };

      // Registrar el producto en PostgreSQL mediante Django.
      await crearItemSDI(token, sdi.id, datosItem);

      // Volver a consultar los productos reales de la SDI.
      const productos = await obtenerItemsSDI(token, sdi.id);
      setItemsSDI(productos);
      setErrorItems("");

      // Limpiar el formulario después de guardar correctamente.
      setNuevoItem({
        articulo: "",
        codigo_plano: "",
        cantidad_a_inspeccionar: "",
        observaciones: "",
      });

      setExitoGuardarItem("Producto registrado correctamente.");
    } catch (error) {
      setErrorGuardarItem(error.message || "No se pudo registrar el producto.");
    } finally {
      setGuardandoItem(false); // Habilitar nuevamente el formulario.
    }
  };
  // ETAPA 21.4 - Recuperar una inspección existente antes de crear otra.
// ETAPA 24 - Consultar inspecciones existentes según el rol.
const abrirInspeccionItem = async (item) => {
  setErrorInspeccion("");
  setInspeccionActual(null);
  setItemEnInspeccion(null);
  setEvidencias([]);
  setEvaluacionVisualConsulta(null); // Limpiar la evaluación anterior.
  try {
    const token = sessionStorage.getItem("ancor.access");
    if (!token) throw new Error("Tu sesión ha expirado.");

    const inspecciones = await obtenerInspeccionesItem(token, item.id);

    // Recuperar la inspección en proceso o la última registrada.
    const inspeccionExistente = inspecciones.find(
      registro => registro.resultado === "en_proceso"
    ) || inspecciones[inspecciones.length - 1];

    if (inspeccionExistente) {
      setInspeccionActual(inspeccionExistente);
      // ETAPA 25.18 - Abrir Inspección para el inspector y Resultado para administración.
      setPestanaActiva(esInspector ? "inspeccion" : "resultado");
      // ETAPA 24.5 - Recuperar la evaluación visual para consulta.
if (!esInspector) {
  const evaluacion = await obtenerInspeccionVisual(
    token,
    inspeccionExistente.id
  );
  setEvaluacionVisualConsulta(evaluacion);
}

      // La consulta de evidencias del administrador requiere
      // habilitar primero el permiso GET en Django.
     // ETAPA 24.8 - Consultar fotografías para todos los roles autorizados.
const fotos = await obtenerEvidenciasInspeccion(
  token,
  inspeccionExistente.id
);
setEvidencias(fotos);
      return;
    }

    // Solo el inspector puede iniciar nuevas inspecciones.
    if (esInspector) {
      setItemEnInspeccion(item);
      setCantidadInspeccion(String(item.cantidad_a_inspeccionar));
      setObservacionInspeccion("");
    } else {
      setErrorInspeccion("Este producto todavía no tiene inspecciones registradas.");
    }
  } catch (error) {
    setErrorInspeccion(error.message || "No se pudieron consultar las inspecciones.");
  }
};    // ETAPA 21.2 - Iniciar una inspección real mediante Django.
  const guardarInicioInspeccion = async (e) => {
    e.preventDefault(); // Evitar recargar la página.
    if (iniciandoInspeccion || !esInspector || !itemEnInspeccion) return;

    setErrorInspeccion("");

    // Validar las unidades del producto seleccionado.
    const cantidad = Number(cantidadInspeccion);
    if (!Number.isInteger(cantidad) || cantidad <= 0 ||
        cantidad > Number(itemEnInspeccion.cantidad_a_inspeccionar)) {
      setErrorInspeccion("Ingresa una cantidad válida para este producto.");
      return;
    }

    setIniciandoInspeccion(true);

    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Registrar la inspección y conservar el ID devuelto por Django.
      const inspeccionCreada = await iniciarInspeccion(token, itemEnInspeccion.id, {
        cantidad_inspeccionada: cantidad,
        observaciones: observacionInspeccion.trim(),
      });

      setInspeccionActual(inspeccionCreada);

      // Limpiar el formulario después del registro.
      setItemEnInspeccion(null);
      setCantidadInspeccion("");
      setObservacionInspeccion("");
      setExitoGuardarItem("Inspección iniciada correctamente.");
    } catch (error) {
      setErrorInspeccion(error.message || "No se pudo iniciar la inspección.");
    } finally {
      setIniciandoInspeccion(false);
    }
  };
  // ETAPA 21.3 - Guarda los siete criterios visuales en Django.
const guardarInspeccionVisual = async (e) => {
  e.preventDefault();

  if (!esInspector || !inspeccionActual) return;

  // Verifica que todos los criterios estén evaluados.
  if (Object.values(criteriosVisuales).some(valor => !valor)) {
    alert("Debes evaluar los siete criterios visuales.");
    return;
  }

  try {
    const token = sessionStorage.getItem("ancor.access");
    if (!token) throw new Error("Tu sesión ha expirado.");

    const resultado = await registrarInspeccionVisual(
      token,
      inspeccionActual.id,
      {
        ...criteriosVisuales,
        observaciones: observacionesVisuales.trim(),
      }
    );
    alert(`Evaluación visual registrada: ${resultado.resultado_visual}`);
    // Mantiene la inspección activa para permitir subir fotografías.
    setExitoEvidencia("");
  } catch (error) {
    alert(error.message || "No se pudo registrar la inspección visual.");
  }
};
  // ETAPA 22 - Subir una fotografía de la inspección a Django.
  const guardarEvidencia = async (e) => {
    e.preventDefault();
    if (!inspeccionActual || !archivoEvidencia || subiendoEvidencia) return;
    setErrorEvidencia("");
    setExitoEvidencia("");
    setSubiendoEvidencia(true);
    try {
      const token = sessionStorage.getItem("ancor.access");
      if (!token) throw new Error("Tu sesión ha expirado.");

      // Registrar la fotografía asociada a la inspección actual.
      await subirEvidenciaInspeccion(
        token, inspeccionActual.id, archivoEvidencia, descripcionEvidencia.trim()
      );
      // Actualizar las evidencias desde PostgreSQL.
      const registros = await obtenerEvidenciasInspeccion(token, inspeccionActual.id);
      setEvidencias(registros);
      setArchivoEvidencia(null);
      setDescripcionEvidencia("");
      setExitoEvidencia("Fotografía registrada correctamente.");
    } catch (error) {
      setErrorEvidencia(error.message || "No se pudo subir la fotografía.");
    } finally {
      setSubiendoEvidencia(false);
    }
  };
  
// ETAPA 23 - Finalizar una inspección y registrar sus unidades aprobadas.
const finalizarInspeccion = async (e) => {
  e.preventDefault();
  if (!esInspector || !inspeccionActual || finalizandoInspeccion) return;

  setErrorFinalizacion("");
  setExitoFinalizacion("");

  const cantidad = Number(cantidadAprobada);
  const total = Number(inspeccionActual.cantidad_inspeccionada);

  // Validar la cantidad aprobada.
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > total) {
    setErrorFinalizacion(`Ingresa una cantidad aprobada entre 1 y ${total}.`);
    return;
  }

  // Solicitar confirmación antes de finalizar.
  if (!window.confirm("¿Confirmas que deseas finalizar esta inspección?")) return;

  setFinalizandoInspeccion(true);

  try {
    const token = sessionStorage.getItem("ancor.access");
    if (!token) throw new Error("Tu sesión ha expirado.");

    // Django valida la evaluación visual y registra el resultado.
    const resultado = await aprobarInspeccion(
      token,
      inspeccionActual.id,
      cantidad
    );


    setInspeccionActual(resultado);
    setExitoFinalizacion(`Inspección finalizada. Resultado: ${resultado.resultado}.`);
    setCantidadAprobada("");
  } catch (error) {
    setErrorFinalizacion(error.message || "No se pudo finalizar la inspección.");
  } finally {
    setFinalizandoInspeccion(false);
  }
};

return (
      <div className="modal-backdrop" onClick={onClose}>
      <div className="modal detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="detail-id">{sdi.codigo_sdi}</span>
            <h2>{sdi.proyecto || "Solicitud de inspección"}</h2>
            <p>Emitida el {sdi.fecha_emision || "—"}</p>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close"/>
          </button>
        </div>
        <div className="detail-grid">
          <div><span>Inspector</span><b>{sdi.inspector_nombre || sdi.inspector_username || "Sin asignar"}</b></div>
          <div><span>Prioridad</span><b>{sdi.prioridad_nombre || sdi.prioridad}</b></div>
          <div><span>Estado</span><b>{sdi.estado_nombre || sdi.estado}</b></div>
          {/* PASO 45.36.9 - Diferenciar el estado administrativo del resultado de calidad. */}
          <div>
            <span>Resultado de calidad</span>
            <b>{resultadoCalidadSDI}</b>
          </div>
          <div><span>Solicitante</span><b>{sdi.solicitante || "—"}</b></div>
          <div><span>Departamento</span><b>{sdi.departamento_solicitante || "—"}</b></div>
        </div>
                {/* ETAPA 42.7 - Inicio formal de la SDI por el inspector. */}
        {esInspector && sdi.estado === "pendiente" && (
          <div className="detail-history">
            <button
              type="button"
              className="button button-primary"
              disabled={iniciandoSDI}
              onClick={confirmarInicioSDI}
            >
              {iniciandoSDI ? "Iniciando SDI..." : "Iniciar SDI"}
            </button>

            {/* Mostrar errores devueltos por Django. */}
            {errorInicioSDI && (
              <p role="alert">{errorInicioSDI}</p>
            )}
          </div>
        )}
                {/* ETAPA 42.9.41 - Finalización formal de la SDI por el inspector. */}
        {esInspector && sdi.estado === "en_proceso" && (
          <div className="detail-history">
            <button
              type="button"
              className="button button-primary"
              disabled={finalizandoSDI}
              onClick={confirmarTerminoSDI}
            >
              {finalizandoSDI ? "Enviando a revisión..." : "Enviar a revisión"}
            </button>

            {/* Mostrar el resultado confirmado por Django. */}
            {errorTerminarSDI && <p role="alert">{errorTerminarSDI}</p>}
            {exitoTerminarSDI && <p>{exitoTerminarSDI}</p>}
          </div>
        )}
        {/* ETAPA 42.9.58 - Cierre exclusivo para administración. */}
        {puedeCerrarSDI && sdi.estado === "pendiente_revision" && ( // Estado oficial de Django.
          <div className="detail-history">
            <button
              type="button"
              className="button button-primary"
              disabled={cerrandoSDI}
              onClick={confirmarCierreSDI}
            >
              {cerrandoSDI ? "Cerrando SDI..." : "Cerrar SDI"}
            </button>

            {/* Mostrar errores y confirmaciones del backend. */}
            {errorCerrarSDI && <p role="alert">{errorCerrarSDI}</p>}
            {exitoCerrarSDI && <p role="status">{exitoCerrarSDI}</p>}
          </div>
        )}
{/* ETAPA 25.2 - Navegación por pestañas del detalle SDI. */}
<div className="detail-tabs">
  {[
    ["productos", "Productos"],
    ["inspeccion", "Inspección"],
    ["resultado", "Resultado"],
  ].map(([id, nombre]) => (
    <button
      key={id}
      type="button"
      className={`button ${pestanaActiva === id ? "button-primary" : "button-outline"}`}
      onClick={() => setPestanaActiva(id)}
    >
      {nombre}
    </button>
  ))}
</div>

        {/* ETAPA 18.4 - Formulario de registro de productos. */}
{/* ETAPA 25.3 - Contenido exclusivo de la pestaña Productos. */}
{pestanaActiva === "productos" && (
  <>
    {/* ETAPA 18.4 - Formulario de registro de productos. */}
    {/* ETAPA 25.13 - Registrar productos solo en SDI pendientes. */}
    {puedeRegistrarItems && sdi.estado === "pendiente" && (
      <div className="detail-history">
        <strong>Agregar producto a la SDI</strong>
  <form onSubmit={guardarNuevoItem}>
    <div className="detail-grid">
      {/* Descripción exacta del artículo. */}
      <label>
        Artículo
        <input
          type="text"
          required
          value={nuevoItem.articulo}
          onChange={e => cambiarCampoItem("articulo", e.target.value)}
        />
      </label>

      {/* Permitir códigos de plano repetidos entre productos. */}
      <label>
        Nombre del Proyecto
        <input
          type="text"
          value={nuevoItem.codigo_plano}
          onChange={e => cambiarCampoItem("codigo_plano", e.target.value)}
        />
      </label>

      {/* Cantidad individual, sin sumar otros artículos. */}
      <label>
        Unidades a inspeccionar
        <input
          type="number"
          min="1"
          step="1"
          required
          value={nuevoItem.cantidad_a_inspeccionar}
          onChange={e => cambiarCampoItem("cantidad_a_inspeccionar", e.target.value)}
        />
      </label>
    </div>

    {/* Instrucciones opcionales que el supervisor deja al inspector. */}
    <label>
      Instrucciones para el inspector (opcional)
      <textarea
        rows="3"
        placeholder="Ej. Verificar soldaduras, dimensiones o tolerancias del  
    plano."
        value={nuevoItem.observaciones}
        onChange={e => cambiarCampoItem("observaciones", e.target.value)}
       />
    </label>

    {/* Mostrar errores y confirmaciones del backend. */}
    {errorGuardarItem && <p role="alert">{errorGuardarItem}</p>}
    {exitoGuardarItem && <p role="status">{exitoGuardarItem}</p>}

    <button
      type="submit"
      className="button button-primary"
      disabled={guardandoItem}
    >
      {guardandoItem ? "Guardando..." : "Guardar producto"}
    </button>
  </form>
</div>
        )}
        {/* ETAPA 18.3 - Mostrar los productos reales de la SDI. */}
<div className="detail-history">
  <strong>Productos a inspeccionar</strong>

  {/* Informar mientras se consultan los productos en Django. */}
  {cargandoItems && <p>Cargando productos...</p>}

  {/* Mostrar los errores de consulta o permisos. */}
  {errorItems && (
    <p role="alert" style={{ color: "#b42318" }}>
      {errorItems}
    </p>
  )}

  {/* Informar cuando la SDI no tenga productos registrados. */}
  {!cargandoItems && !errorItems && itemsSDI.length === 0 && (
    <p>Esta SDI todavía no tiene productos registrados.</p>
  )}

  {/* Mostrar cada producto con sus datos individuales. */}
{!cargandoItems && !errorItems && itemsSDI.length > 0 && (
  <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th>N.º</th>
          <th>ARTÍCULO</th>
          <th>CÓDIGO DE PLANO</th>
          <th>UNIDADES A INSPECCIONAR</th>
          <th>INSTRUCCIONES PARA EL INSPECTOR</th>
          {/* Permitir consultar inspecciones desde cualquier rol autorizado. */}
          <th>ACCIÓN</th>
        </tr>
      </thead>
      <tbody>
        {itemsSDI.map(item => (
          <tr key={item.id}>
            <td>{item.orden}</td>
            <td>{item.articulo}</td>
            <td>{item.codigo_plano || "—"}</td>
            <td>{item.cantidad_a_inspeccionar}</td>
            {/* Mostrar las instrucciones opcionales del producto. */}
            <td>{item.observaciones || "Sin instrucciones adicionales"}</td>
            {/* ETAPA 21.2 - Seleccionar el producto para inspección. */}
            <td>
              <button
                type="button"
                className="button button-primary"
                disabled={esInspector && sdi.estado !== "en_proceso"}
                onClick={() => abrirInspeccionItem(item)}
              >
                {esInspector ? "Iniciar inspección" : "Ver inspección"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
</div>
{/* ETAPA 21.2 - Formulario para iniciar la inspección real. */}
{esInspector && itemEnInspeccion && (
  <div className="detail-history">
    <strong>Iniciar inspección: {itemEnInspeccion.articulo}</strong>

    <form onSubmit={guardarInicioInspeccion}>
      <label>
        Unidades a inspeccionar
        <input
          type="number"
          min="1"
          max={itemEnInspeccion.cantidad_a_inspeccionar}
          step="1"
          required
          value={cantidadInspeccion}
          onChange={e => setCantidadInspeccion(e.target.value)}
        />
      </label>

      <label>
        Observaciones iniciales
        <textarea
          rows="3"
          value={observacionInspeccion}
          onChange={e => setObservacionInspeccion(e.target.value)}
        />
      </label>

      {errorInspeccion && (
        <p role="alert" style={{ color: "#b42318" }}>
          {errorInspeccion}
        </p>
      )}

      <div className="modal-actions">
        <button
          type="button"
          className="button button-outline"
          disabled={iniciandoInspeccion}
          onClick={() => setItemEnInspeccion(null)}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="button button-primary"
          disabled={iniciandoInspeccion}
        >
          {iniciandoInspeccion ? "Registrando..." : "Confirmar inicio"}
        </button>
      </div>
    </form>
  </div>
)}
{/* ETAPA 25.4 - Cerrar la pestaña Productos. */}
  </>
)}
{/* ETAPA 25.5 - Contenido de la pestaña Resultado. */}
{pestanaActiva === "resultado" && (
  <>
{/* ETAPA 24.1 - Consulta de resultados para administración. */}
{!esInspector && inspeccionActual && (
  <div className="detail-history">
    <strong>
      Resultado de inspección N.º {inspeccionActual.numero_inspeccion}
    </strong>

    <p><strong>Inspector:</strong> {inspeccionActual.inspector_nombre || inspeccionActual.inspector_username}</p>
    <p><strong>Estado:</strong> {inspeccionActual.resultado_nombre || inspeccionActual.resultado}</p>
    <p><strong>Cantidad inspeccionada:</strong> {inspeccionActual.cantidad_inspeccionada}</p>
    <p><strong>Cantidad aprobada:</strong> {inspeccionActual.cantidad_aprobada}</p>
    <p><strong>Observaciones:</strong> {inspeccionActual.observaciones || "Sin observaciones"}</p>
    <p>
      <strong>Fecha de finalización:</strong>{" "}
      {inspeccionActual.fecha_fin
        ? new Date(inspeccionActual.fecha_fin).toLocaleString("es-CL")
        : "Pendiente"}
    </p>

    <small>Información de solo lectura.</small>
  </div>
)}
{/* ETAPA 25.6 - Cierre de la pestaña Resultado. */}
  </>
)}
{/* ETAPA 25.7 - Contenido de la pestaña Evaluación visual. */}
{pestanaActiva === "inspeccion" && (
  <>
  {/* PASO 45.35.10 - Mostrar automáticamente las inspecciones de la SDI. */}
<div className="detail-history">
  <strong>Inspecciones registradas</strong>

  {/* Informar mientras Django responde. */}
  {cargandoInspeccionesSDI && <p>Cargando inspecciones...</p>}

  {/* Mostrar errores reales de consulta. */}
  {errorInspeccionesSDI && (
    <p role="alert">{errorInspeccionesSDI}</p>
  )}

  {/* Informar cuando todavía no existen inspecciones. */}
  {!cargandoInspeccionesSDI && !errorInspeccionesSDI &&
    inspeccionesSDI.every(grupo => grupo.inspecciones.length === 0) && (
      <p>Esta SDI todavía no tiene inspecciones registradas.</p>
    )}

  {/* Mantener las inspecciones separadas por producto. */}
  {!cargandoInspeccionesSDI && !errorInspeccionesSDI &&
    inspeccionesSDI.map(({ item, inspecciones }) =>
      inspecciones.length > 0 && (
        <div key={item.id} className="table-scroll">
          <p><strong>Producto:</strong> {item.articulo}</p>
          <table>
            <thead>
              <tr>
                <th>INTENTO</th>
                <th>INSPECTOR</th>
                <th>INSPECCIONADAS</th>
                <th>APROBADAS</th>
                <th>RESULTADO</th>
              </tr>
            </thead>
            <tbody>
              {inspecciones.map(inspeccion => (
                <tr key={inspeccion.id}>
                  <td>{inspeccion.numero_inspeccion}</td>
                  <td>{inspeccion.inspector_nombre || inspeccion.inspector_username || "—"}</td>
                  <td>{inspeccion.cantidad_inspeccionada}</td>
                  <td>{inspeccion.cantidad_aprobada ?? "—"}</td>
                  <td>{inspeccion.resultado_nombre || inspeccion.resultado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    )}
</div>

  {/* ETAPA 25.19 - Evaluación visual de solo lectura. */}
{!esInspector && inspeccionActual && evaluacionVisualConsulta && (
  <div className="detail-history">
    <h4>Evaluación visual</h4>
    {[
      ["Rebarbas", "rebarbas"],
      ["Rayaduras", "rayaduras"],
      ["Golpes", "golpes"],
      ["Deformidad", "deformidad"],
      ["Pintura", "pintura"],
      ["Burbujas", "burbujas"],
      ["Planitud", "planitud"],
    ].map(([nombre, campo]) => (
      <p key={campo}>
        <strong>{nombre}:</strong>{" "}
        {evaluacionVisualConsulta[campo] || "Sin registro"}
      </p>
    ))}
    <small>Información de solo lectura.</small>
  </div>
)}

{/* ETAPA 21.3 - Evaluación visual de la inspección iniciada. */}
{esInspector && inspeccionActual && (
  <div className="detail-history">
    <strong>Evaluación visual — Inspección N.º {inspeccionActual.id}</strong>

    {[
      ["rebarbas", "Rebarbas"],
      ["rayaduras", "Rayaduras"],
      ["golpes", "Golpes"],
      ["deformidad", "Deformidad"],
      ["pintura", "Pintura"],
      ["burbujas", "Burbujas"],
      ["planitud", "Planitud"],
    ].map(([campo, nombre]) => (
      <label key={campo}>
        {nombre}
        <select
          required
          value={criteriosVisuales[campo]}
          onChange={e => setCriteriosVisuales(actual => ({
            ...actual,
            [campo]: e.target.value,
          }))}
        >
          <option value="">Seleccionar resultado</option>
          <option value="conforme">Conforme</option>
          <option value="no_conforme">No conforme</option>
          <option value="no_aplica">No aplica</option>
        </select>
      </label>
    ))}

    <label>
      Observaciones de inspección visual
      <textarea
        rows="3"
        value={observacionesVisuales}
        onChange={e => setObservacionesVisuales(e.target.value)}
      />
        </label>

    {/* ETAPA 21.3 - Guardar los criterios visuales en Django. */}
    <button
      type="button"
      className="button button-primary"
      onClick={guardarInspeccionVisual}
    >
      Guardar evaluación visual
    </button>
  </div>
)}
{/* ETAPA 25.8 - Cierre de la pestaña Evaluación visual. */}
  </>
)}
{/* ETAPA 25.9 - Contenido de la pestaña Evidencias. */}
{/* ETAPA 25.17 - Evidencias fotográficas dentro de Inspección. */}
{pestanaActiva === "inspeccion" && (
  <>

{/* ETAPA 22 - Registro de evidencias fotográficas. */}
{inspeccionActual && (
  <div className="detail-history">
    <strong>Evidencias fotográficas — Inspección N.º {inspeccionActual.id}</strong>

    {/* ETAPA 24.9 - Solo el inspector puede subir fotografías en inspecciones activas. */}
{esInspector && inspeccionActual?.resultado === "en_proceso" && (
  <form onSubmit={guardarEvidencia}>
      <label>
        Seleccionar fotografía
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          required
          onChange={e => setArchivoEvidencia(e.target.files[0] || null)}
        />
      </label>

      <label>
        Descripción de la evidencia
        <textarea
          rows="3"
          value={descripcionEvidencia}
          onChange={e => setDescripcionEvidencia(e.target.value)}
        />
      </label>

      {errorEvidencia && <p role="alert">{errorEvidencia}</p>}
      {exitoEvidencia && <p role="status">{exitoEvidencia}</p>}

      <button
        type="submit"
        className="button button-primary"
        disabled={!archivoEvidencia || subiendoEvidencia}
      >
        {subiendoEvidencia ? "Subiendo..." : "Guardar fotografía"}
      </button>
    </form>
)}
   {/* ETAPA 22 - Fotografías registradas en la inspección. */}
{evidencias.length > 0 && (
  <div className="detail-history">
    <strong>Fotografías registradas ({evidencias.length})</strong>
    {evidencias.map((evidencia) => (
  <div
    key={evidencia.id}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "6px",
      padding: "12px 0",
      borderBottom: "1px solid #e5e7eb",
    }}
  >
    <a
      href={`http://localhost:8000${evidencia.archivo}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Ver fotografía
    </a>

    {evidencia.descripcion && <p>{evidencia.descripcion}</p>}

    <small>
      Registrada por: {evidencia.subido_por_username || "No disponible"}
    </small>
  </div>
))}
    
  </div>
)}
  </div>
)}
{/* ETAPA 25.10 - Cierre de la pestaña Evidencias. */}
  </>
)}
{/* ETAPA 25.11 - Finalización exclusiva de la pestaña Resultado. */}
{pestanaActiva === "resultado" && (
  <>
{/* ETAPA 25.12 - Cierre de la finalización en Resultado. */}
  </>
)}

{/* ETAPA 23 - Finalización de la inspección por el inspector. */}
{esInspector && inspeccionActual?.resultado === "en_proceso" && (
  <form className="detail-history" onSubmit={finalizarInspeccion}>
    <strong>Finalizar inspección</strong>
    <p>Indica cuántas unidades fueron aprobadas durante la inspección.</p>

    <label>
      Cantidad aprobada
      <input
        type="number"
        min="1"
        max={inspeccionActual.cantidad_inspeccionada}
        step="1"
        value={cantidadAprobada}
        onChange={(e) => setCantidadAprobada(e.target.value)}
        required
      />
    </label>

    <small>
      Unidades inspeccionadas: {inspeccionActual.cantidad_inspeccionada}
    </small>

    {errorFinalizacion && <p className="error-message">{errorFinalizacion}</p>}

    <button
      type="submit"
      className="button button-primary"
      disabled={finalizandoInspeccion}
    >
      {finalizandoInspeccion ? "Finalizando..." : "Finalizar inspección"}
    </button>
  </form>
)}

{exitoFinalizacion && (
  <div className="detail-history">
    <strong>{exitoFinalizacion}</strong>
  </div>
)}
        <div className="detail-history">
          <strong>Observaciones</strong>
          <p>{sdi.observaciones || "Sin observaciones registradas."}</p>
          <small>Consulta de solo lectura. Los estados se gestionan desde Django.</small>
        </div>
        <div className="modal-actions">
          <button className="button button-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// Formulario REAL de creación de SDI.
function NuevaSDIModal({
  inspectores, cargandoInspectores, guardando, error, onSubmit, onClose,
}) {
  const enviarFormulario = event => {
    event.preventDefault();
    if (guardando) return;
    const form = new FormData(event.currentTarget);

    // Los nombres coinciden exactamente con SDISerializer de Django.
    const datosSDI = {
      prefijo_bod: form.get("prefijo_bod") === "on",
      activacion_proyecto: String(form.get("activacion_proyecto") || "").trim(),
      numero_sdi: String(form.get("numero_sdi") || "").trim(),
      fecha_emision: String(form.get("fecha_emision") || ""),
      proyecto: String(form.get("proyecto") || "").trim(),
      departamento_solicitante: String(form.get("departamento_solicitante") || "").trim(),
      solicitante: String(form.get("solicitante") || "").trim(),
      inspector: Number(form.get("inspector")), // Obligatorio en creación manual.
      prioridad: String(form.get("prioridad") || "media"),
      observaciones: String(form.get("observaciones") || "").trim(),
    };
    onSubmit(datosSDI);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal nueva-sdi-modal" onSubmit={enviarFormulario}
        onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-icon"><Icon name="clipboard"/></div>
            <h2>Nueva solicitud SDI</h2>
            <p>Registro oficial conectado a Django y PostgreSQL.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar"
            disabled={guardando} onClick={onClose}>
            <Icon name="close"/>
          </button>
        </div>

        {/* Identificación del código de la solicitud. */}
        <div className="form-row">
          <label>Activación del proyecto
            <input name="activacion_proyecto" maxLength={6}
              placeholder="Ej. 000985" required autoFocus disabled={guardando}/>
          </label>
          <label>Número de SDI
            <input name="numero_sdi" placeholder="Ej. 228"
              required disabled={guardando}/>
          </label>
        </div>

        <label>Proyecto
          <input name="proyecto" maxLength={200}
            placeholder="Nombre del proyecto" required disabled={guardando}/>
        </label>

        {/* Fecha y prioridad. */}
        <div className="form-row">
          <label>Fecha de emisión
            <input type="date" name="fecha_emision" required disabled={guardando}/>
          </label>
          <label>Prioridad
            <select name="prioridad" defaultValue="media" disabled={guardando}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
        </div>

        {/* Información del solicitante. */}
        <div className="form-row">
          <label>Departamento solicitante
            <select name="departamento_solicitante" defaultValue="" required disabled={guardando}>
              <option value="" disabled>Seleccione un departamento</option>
              <option value="Bodega">Bodega</option>
              <option value="Producción">Producción</option>
              <option value="Calidad">Calidad</option>
            </select>
          </label>
          <label>Solicitante
            <input name="solicitante" maxLength={150}
              placeholder="Nombre del solicitante" required disabled={guardando}/>
          </label>
        </div>
        {/* Inspector obligatorio en la creación manual; lista obtenida de Django. */}
        <label>Inspector asignado
          <select name="inspector" defaultValue="" required
            disabled={cargandoInspectores || guardando}>
            <option value="">
              {cargandoInspectores ? "Cargando inspectores..." : "Seleccione un inspector"}
            </option>
            {inspectores.filter(inspector => inspector.activo === true).map(inspector => {
              const nombre = [inspector.first_name, inspector.last_name]
                .filter(Boolean).join(" ") || inspector.username;
              return (
                <option key={inspector.id} value={inspector.id}>
                  {nombre} - {inspector.username}
                </option>
              );
            })}
          </select>
        </label>

        {/* Campo booleano reconocido por el backend. */}
        <label className="sdi-checkbox">
          <input type="checkbox" name="prefijo_bod" disabled={guardando}/>
          Aplicar prefijo BOD
        </label>

        <label>Observaciones
          <textarea name="observaciones" rows="3"
            placeholder="Observaciones adicionales (opcional)"
            disabled={guardando}/>
        </label>

        {/* Mensajes de validación devueltos por Django. */}
        {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="button button-outline"
            onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary"
            disabled={guardando || cargandoInspectores || inspectores.length === 0}>
            <Icon name="plus" size={17}/>
            {guardando ? "Guardando..." : "Crear SDI"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// ETAPA 15.4 - FORMULARIO REAL DE EDICIÓN SDI
// ============================================================
function EditarSDIModal({
  sdi, inspectores, cargandoInspectores, guardando, error, onSubmit, onClose,
}) {
  // Inspector original: se conserva incluso si ya no está disponible.
  const inspectorActual = inspectores.find(i => Number(i.id) === Number(sdi.inspector));
  const inspectorExiste = Boolean(inspectorActual);

  // Enviar solo los campos autorizados por el backend.
  const enviarFormulario = event => {
    event.preventDefault();
    if (guardando || cargandoInspectores) return;

    const form = new FormData(event.currentTarget);
    const datos = {
      fecha_emision: String(form.get("fecha_emision") || ""),
      proyecto: String(form.get("proyecto") || "").trim(),
      departamento_solicitante: String(form.get("departamento_solicitante") || "").trim(),
      solicitante: String(form.get("solicitante") || "").trim(),
      prioridad: String(form.get("prioridad") || "media"),
      observaciones: String(form.get("observaciones") || "").trim(),
    };

    // Solo enviar el inspector si realmente cambió.
    const nuevoInspector = Number(form.get("inspector"));
    if (nuevoInspector && nuevoInspector !== Number(sdi.inspector)) {
      datos.inspector = nuevoInspector;
    }

    onSubmit(datos);
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!guardando) onClose(); }}>
      {/* PASO 46.10 - Reutilizar el diseño validado de Nueva SDI. */}
<form
  className="modal nueva-sdi-modal"
  onSubmit={enviarFormulario}
  onClick={e => e.stopPropagation()}
>
        <div className="modal-head">
          <div>
            <div className="modal-icon"><Icon name="clipboard"/></div>
            <h2>Editar solicitud SDI</h2>
            <p>{sdi.codigo_sdi} · Registro oficial de Django</p>
          </div>
          <button type="button" className="icon-button"
            aria-label="Cerrar" disabled={guardando} onClick={onClose}>
            <Icon name="close"/>
          </button>
        </div>

        {/* El código y estado son informativos; no se pueden modificar. */}
        <div className="form-row">
          <label>Código SDI
            <input value={sdi.codigo_sdi || ""} disabled readOnly/>
          </label>
          <label>Estado actual
            <input value={sdi.estado_nombre || sdi.estado || ""} disabled readOnly/>
          </label>
        </div>

        <label>Proyecto
          <input name="proyecto" defaultValue={sdi.proyecto || ""}
            maxLength={200} required autoFocus disabled={guardando}/>
        </label>

        <div className="form-row">
          <label>Fecha de emisión
            <input type="date" name="fecha_emision"
              defaultValue={sdi.fecha_emision || ""}
              required disabled={guardando}/>
          </label>
          <label>Prioridad
            <select name="prioridad" defaultValue={sdi.prioridad || "media"}
              disabled={guardando}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>Departamento solicitante
            <input name="departamento_solicitante"
              defaultValue={sdi.departamento_solicitante || ""}
              maxLength={150} required disabled={guardando}/>
          </label>
          <label>Solicitante
            <input name="solicitante" defaultValue={sdi.solicitante || ""}
              maxLength={150} required disabled={guardando}/>
          </label>
        </div>

        {/* Los inspectores provienen de la API de Django. */}
        <label>Inspector asignado
          <select name="inspector" defaultValue={String(sdi.inspector || "")}
            required disabled={cargandoInspectores || guardando}>
            {!inspectorExiste && sdi.inspector && (
              <option value={sdi.inspector}>
                {sdi.inspector_nombre || sdi.inspector_username || "Inspector actual"}
              </option>
            )}
            <option value="" disabled>Seleccione un inspector</option>
            {inspectores
              .filter(inspector =>
                inspector.activo === true ||
                Number(inspector.id) === Number(sdi.inspector)
              )
              
              .map(inspector => {
              const nombre = [inspector.first_name, inspector.last_name]
                .filter(Boolean).join(" ") || inspector.username;
              return (
                <option key={inspector.id} value={inspector.id}>
                  {nombre} - {inspector.username}
                </option>
              );
            })}
          </select>
        </label>

        <label>Observaciones
          <textarea name="observaciones" rows="3"
            defaultValue={sdi.observaciones || ""}
            disabled={guardando}/>
        </label>

        {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="button button-outline"
            onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="button button-primary"
            disabled={guardando || cargandoInspectores || inspectores.length === 0}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * ETAPA 17.14 - Formulario de registro de inspectores.
 * Envía los datos a Django mediante inviteMember().
 */
function InviteModal({ onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={onSubmit}
        onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-icon"><Icon name="users"/></div>
            <h2>Registrar inspector</h2>
            <p>Crear una cuenta de inspector en ANCOR TECMIN.</p>
          </div>
          <button type="button" className="icon-button"
            aria-label="Cerrar" onClick={onClose}>
            <Icon name="close"/>
          </button>
        </div>

        {/* Datos personales del inspector. */}
        <label>Nombre
          <input name="first_name" required autoFocus/>
        </label>
        <label>Apellido
          <input name="last_name" required/>
        </label>
        <label>Correo electrónico
          <input name="email" type="email" required/>
        </label>

        {/* Credenciales para iniciar sesión en React. */}
        <label>Nombre de usuario
          <input name="username" autoComplete="username" required/>
        </label>
        <label>Contraseña inicial
          <input name="password" type="password"
            autoComplete="new-password" required/>
        </label>

        <div className="demo-notice">
          La cuenta se registrará en Django con el rol Inspector.
        </div>

        <div className="modal-actions">
          <button type="button" className="button button-outline"
            onClick={onClose}>Cancelar</button>
          <button type="submit" className="button button-primary">
            Registrar inspector
          </button>
        </div>
      </form>
    </div>
  );
}


// Fila de configuración.
function SettingRow({ title, description, checked, onChange }) {
  return (
    <label className="settings-row">
      <span><strong>{title}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}/>
    </label>
  );
}

// Tarjeta de indicadores del dashboard.
function Metric({ label, value, change, note, icon, tone, data, down }) {
  return (
    <div className="card metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <div className={`metric-icon ${tone}`}><Icon name={icon} size={18}/></div>
      </div>
      <div className="metric-value-row">
        <strong>{value}</strong>
        {data?.length > 0 && <Sparkline data={data} tone={tone}/>}
      </div>
      <div className="metric-foot">
        <b className={down ? "change-down" : ""}>{down ? "↓" : "↑"} {change}</b>
        <span>{note}</span>
      </div>
    </div>
  );
}

// Gráfico pequeño opcional.
function Sparkline({ data, tone }) {
  const points = data.map((value, index) => `${index * 10},${30 - value * 0.3}`).join(" ");
  return (
    <svg className={`sparkline ${tone}`} viewBox="0 0 110 32" preserveAspectRatio="none">
      <polyline points={points}/>
    </svg>
  );
}

// Estado visual de actividades de demostración.
function Status({ status }) {
  const tipo = status === "En proceso" ? "progress"
    : status === "Completada" ? "done" : "pending";
  return <span className={`status status-${tipo}`}><i/>{status}</span>;
}

export default App;
