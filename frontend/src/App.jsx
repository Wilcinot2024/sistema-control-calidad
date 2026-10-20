
import React, { useEffect, useMemo, useRef, useState } from "react";
import logoAncor from "./assets/Logotipo ANCOR TECMIN.png";
import { iniciarSesion, obtenerUsuarioActual } from "./services/authService";
// Servicios para gestionar SDI e inspectores mediante Django.
import {
  obtenerSDI,
  obtenerInspectores,
  crearSDI,
  editarSDI,
  crearInspector,
  cambiarEstadoInspector,
  obtenerItemsSDI,
  crearItemSDI, // ETAPA 18.4 - Registrar productos en Django.
  iniciarInspeccion,
  registrarInspeccionVisual, // guardar evaluacion visual.
} from "./services/sdiService";

// ============================================================
// ANCOR TECMIN - CONTROL DE CALIDAD
// Las SDI se gestionan en Django/PostgreSQL.
// Las actividades, gráficos y equipo siguen siendo demostrativos.
// ============================================================

// Registros locales de ejemplo: no representan SDI de PostgreSQL.
const seedItems = [
  { id: "INS-0248", title: "Inspección de soldadura · Línea 04", area: "Planta Norte", owner: "Carlos Muñoz", initials: "CM", priority: "Alta", status: "En proceso", date: "Hoy, 10:30", kind: "Inspección", observation: "Revisar el cordón de soldadura en la unión norte." },
  { id: "ACT-0247", title: "Revisar certificados de material", area: "Recepción", owner: "Daniela Rojas", initials: "DR", priority: "Media", status: "Pendiente", date: "Hoy, 12:00", kind: "Actividad", observation: "" },
  { id: "INS-0246", title: "Control dimensional · Pieza M-82", area: "Taller Mecánico", owner: "Felipe Soto", initials: "FS", priority: "Alta", status: "En proceso", date: "Hoy, 14:00", kind: "Inspección", observation: "" },
  { id: "ACT-0245", title: "Actualizar registro de calibración", area: "Laboratorio", owner: "Valentina Pérez", initials: "VP", priority: "Baja", status: "Pendiente", date: "Mañana, 09:00", kind: "Actividad", observation: "" },
  { id: "INS-0244", title: "Inspección visual de estructura", area: "Planta Sur", owner: "Carlos Muñoz", initials: "CM", priority: "Media", status: "Completada", date: "Ayer, 16:20", kind: "Inspección", observation: "Inspección completada sin observaciones." },
];

const seedAudit = [
  { id: 1, initials: "CM", color: "blue", actor: "Carlos Muñoz", action: "actualizó el estado de", itemId: "INS-0248", time: "Hace 12 min", icon: "↻" },
  { id: 2, initials: "DR", color: "purple", actor: "Daniela Rojas", action: "agregó una observación a", itemId: "ACT-0247", time: "Hace 38 min", icon: "✎" },
  { id: 3, initials: "FS", color: "green", actor: "Felipe Soto", action: "completó", itemId: "INS-0244", time: "Hace 1 h", icon: "✓" },
];

const team = [
  { initials: "GW", name: "Guilbaud Wilcinot", role: "Analista funcional y líder de integración", color: "navy" },
  { initials: "CM", name: "Carlos Muñoz", role: "Desarrollador Backend y Base de Datos", color: "blue" },
  { initials: "DR", name: "Daniela Rojas", role: "Desarrolladora Frontend, UX y QA", color: "purple" },
  { initials: "FS", name: "Felipe Soto", role: "Inspector de calidad", color: "green" },
];

// Datos exclusivos de los gráficos de demostración.
const periods = {
  "Esta semana": {
    title: "Rendimiento semanal",
    subtitle: "Seguimiento de actividades del equipo",
    bars: [["Lun", 38, 20], ["Mar", 54, 32], ["Mié", 45, 25], ["Jue", 72, 42], ["Vie", 58, 34], ["Sáb", 27, 12], ["Dom", 18, 8]],
    total: 42, completed: 26, pending: 10, progress: 6,
  },
  "Este mes": {
    title: "Rendimiento mensual",
    subtitle: "Resumen de las últimas semanas",
    bars: [["Sem 1", 42, 28], ["Sem 2", 58, 32], ["Sem 3", 48, 36], ["Sem 4", 78, 40], ["Sem 5", 63, 24]],
    total: 248, completed: 178, pending: 25, progress: 45,
  },
  "Últimos 7 días": {
    title: "Últimos 7 días",
    subtitle: "Actividad día por día",
    bars: [["Vie", 38, 20], ["Sáb", 54, 32], ["Dom", 45, 25], ["Lun", 72, 42], ["Mar", 58, 34], ["Mié", 27, 12], ["Jue", 66, 30]],
    total: 42, completed: 29, pending: 8, progress: 5,
  },
};

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
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    filter: <><path d="M4 6h16M7 12h10m-7 6h4"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
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
  // Datos de demostración.
  const [items, setItems] = useState(() => readJson("ancor.demo.activities.v1", seedItems));
  const [members, setMembers] = useState(() => readJson("ancor.demo.team.v1", team));
  const [audit, setAudit] = useState(() => readJson("ancor.demo.audit.v1", seedAudit));
  const [period, setPeriod] = useState(() => readJson("ancor.demo.period.v1", "Esta semana"));
  const [preferences, setPreferences] = useState(() => readJson("ancor.demo.preferences.v1", {
    email: true, weeklySummary: false, compact: false,
  }));

  // Datos reales de solicitudes.
  const [sdis, setSdis] = useState([]);
  const [sdiLoading, setSdiLoading] = useState(false);
  const [sdiError, setSdiError] = useState("");
  const [selectedSdi, setSelectedSdi] = useState(null);

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

  // Navegación y filtros.
  const [activeNav, setActiveNav] = useState("Panel de control");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [areaFilter, setAreaFilter] = useState("Todas las áreas");
  const [showAreaFilter, setShowAreaFilter] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Ventanas y acciones locales.
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultKind, setDefaultKind] = useState("Actividad");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
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
  }, [session]);

  
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
  useEffect(() => { localStorage.setItem("ancor.demo.activities.v1", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("ancor.demo.team.v1", JSON.stringify(members)); }, [members]);
  useEffect(() => { localStorage.setItem("ancor.demo.audit.v1", JSON.stringify(audit)); }, [audit]);
  useEffect(() => { localStorage.setItem("ancor.demo.period.v1", JSON.stringify(period)); }, [period]);
  useEffect(() => { localStorage.setItem("ancor.demo.preferences.v1", JSON.stringify(preferences)); }, [preferences]);

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

  // Estadísticas calculadas exclusivamente desde las SDI del backend.
  const sdiCounts = useMemo(() => ({
    total: sdis.length,
    pending: sdis.filter(s => s.estado === "pendiente").length,
    progress: sdis.filter(s => s.estado === "en_proceso").length,
    approved: sdis.filter(s => s.estado === "aprobada").length,
    closed: sdis.filter(s => s.estado === "cerrada").length,
    rejected: sdis.filter(s => s.estado === "rechazada").length,
    concession: sdis.filter(s => s.estado === "concesion").length,
  }), [sdis]);

  // Búsqueda en las solicitudes reales.
  const visibleSdis = useMemo(() => sdis.filter(s =>
    `${s.codigo_sdi} ${s.proyecto} ${s.inspector_nombre || s.inspector_username || ""} ${s.estado_nombre || s.estado}`
      .toLowerCase().includes(query.toLowerCase())
  ), [sdis, query]);

  // Filtros para las actividades de demostración.
  const areas = useMemo(() => ["Todas las áreas", ...new Set(items.map(i => i.area))], [items]);
  const visibleItems = useMemo(() => items.filter(item => {
    const texto = `${item.id} ${item.title} ${item.owner} ${item.area}`.toLowerCase();
    return texto.includes(query.toLowerCase())
      && (filter === "Todas" || item.status === filter)
      && (areaFilter === "Todas las áreas" || item.area === areaFilter)
      && (activeNav !== "Inspecciones" || item.kind === "Inspección");
  }), [items, query, filter, areaFilter, activeNav]);

  // Indicadores del gráfico de demostración.
  const currentPeriod = periods[period];
  const periodCounts = {
    pending: Math.max(0, currentPeriod.pending + items.filter(i => i.status === "Pendiente").length - 2),
    progress: Math.max(0, currentPeriod.progress + items.filter(i => i.status === "En proceso").length - 2),
    completed: Math.max(0, currentPeriod.completed + items.filter(i => i.status === "Completada").length - 1),
  };
  periodCounts.total = periodCounts.pending + periodCounts.progress + periodCounts.completed;
  periodCounts.completion = periodCounts.total ? Math.round(periodCounts.completed / periodCounts.total * 100) : 0;
  periodCounts.progressPercent = periodCounts.total ? Math.round(periodCounts.progress / periodCounts.total * 100) : 0;
  periodCounts.pendingPercent = Math.max(0, 100 - periodCounts.completion - periodCounts.progressPercent);

  // Muestra notificaciones breves.
  const notify = message => {
    setToast(message);
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(""), 2800);
  };

  // Registra movimientos locales de demostración.
  const addAudit = (action, item) => {
    const initials = session?.name?.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "AC";
    setAudit(current => [{
      id: Date.now(), initials, color: "blue",
      actor: session?.name || "Usuario",
      action, itemId: item.id, time: "Ahora", icon: "↻",
    }, ...current]);
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
      setNotificationsRead(false);
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
    setNotificationsOpen(false);
    setSelectedSdi(null);
    setShowNuevaSdi(false);
    setLoginError("");
  };

  // Abre el formulario real y carga los inspectores desde Django.
  const abrirNuevaSdi = async () => {
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


  // Abre el formulario local de actividades o inspecciones de ejemplo.
  const openNewItem = (kind = "Actividad") => {
    setEditing(null);
    setSelected(null);
    setDefaultKind(kind);
    setShowModal(true);
  };

  // Crea o modifica actividades de demostración.
  const submitItem = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const owner = String(data.get("owner") || "").trim();
    const initials = owner.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const formItem = {
      title: String(data.get("title") || "").trim(),
      area: String(data.get("area") || "").trim(),
      owner, initials,
      priority: data.get("priority"),
      kind: data.get("kind"),
      observation: String(data.get("observation") || "").trim(),
    };
    if (editing) {
      const updated = { ...editing, ...formItem };
      setItems(actuales => actuales.map(i => i.id === editing.id ? updated : i));
      setSelected(updated);
      addAudit("editó", updated);
      notify("Actividad actualizada.");
    } else {
      const next = Math.max(248, ...items.map(i => Number(i.id.match(/\d+$/)?.[0] || 0))) + 1;
      const item = {
        id: `${formItem.kind === "Inspección" ? "INS" : "ACT"}-${next}`,
        ...formItem, status: "Pendiente", date: "Hoy",
      };
      setItems(actuales => [item, ...actuales]);
      setFilter("Todas");
      setAreaFilter("Todas las áreas");
      setNotificationsRead(false);
      addAudit("creó", item);
      notify("Actividad de demostración creada.");
    }
    setEditing(null);
    setShowModal(false);
  };

  // Cambia el estado de una actividad local, nunca el de una SDI real.
  const updateStatus = (item, status) => {
    const updated = { ...item, status };
    setItems(actuales => actuales.map(i => i.id === item.id ? updated : i));
    setSelected(updated);
    addAudit(`cambió el estado a "${status}" de`, updated);
    notify(`Estado actualizado: ${status}.`);
  };

  // Exporta únicamente las actividades de demostración.
  const exportCsv = () => {
    const rows = [
      ["ID", "Tipo", "Actividad", "Área", "Responsable", "Prioridad", "Estado", "Fecha", "Observaciones"],
      ...visibleItems.map(i => [i.id, i.kind, i.title, i.area, i.owner, i.priority, i.status, i.date, i.observation || ""]),
    ];
    const csv = "\uFEFF" + rows.map(row =>
      row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(";")
    ).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `actividades-calidad-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Archivo CSV descargado.");
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
        { name: "Actividades", icon: "clipboard", count: String(items.filter(i => i.status !== "Completada").length) },
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

  // Tabla de actividades locales.
  const activityTable = (limit = Infinity) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>ACTIVIDAD</th><th>RESPONSABLE</th><th>PRIORIDAD</th>
            <th>ESTADO</th><th>FECHA</th><th/>
          </tr>
        </thead>
        <tbody>
          {visibleItems.slice(0, limit).map(item => (
            <tr key={item.id} onClick={() => setSelected(item)}>
              <td>
                <div className="task-name">
                  <span className={`task-icon ${item.kind === "Inspección" ? "inspect" : ""}`}>
                    {item.kind === "Inspección" ? "⌕" : "▤"}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.id} <i/> {item.area}</small>
                  </span>
                </div>
              </td>
              <td><div className="owner"><div className="avatar avatar-small">{item.initials}</div>{item.owner}</div></td>
              <td><span className={`priority priority-${item.priority.toLowerCase()}`}><i/>{item.priority}</span></td>
              <td><Status status={item.status}/></td>
              <td className="date-cell">{item.date}</td>
              <td>
                <button className="row-more" aria-label={`Ver ${item.id}`}
                  onClick={e => { e.stopPropagation(); setSelected(item); }}>
                  <Icon name="more" size={17}/>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visibleItems.length === 0 && <div className="empty-state">No encontramos registros con esos criterios.</div>}
    </div>
  );

  // Tabla de SDI reales; las acciones de cambio de estado no se simulan.
  const sdiTable = (limit = Infinity) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>SOLICITUD SDI</th><th>INSPECTOR</th><th>PRIORIDAD</th>
            <th>ESTADO</th><th>EMISIÓN</th><th/>
          </tr>
        </thead>
        <tbody>
          {visibleSdis.slice(0, limit).map(sdi => (
            <tr key={sdi.id} onClick={() => setSelectedSdi(sdi)}>
              <td>
                <div className="task-name">
                  <span className="task-icon inspect">⌕</span>
                  <span>
                    <strong>{sdi.proyecto || "Sin proyecto"}</strong>
                    <small>{sdi.codigo_sdi} <i/> {sdi.departamento_solicitante || "Sin departamento"}</small>
                  </span>
                </div>
              </td>
              <td><div className="owner">{sdi.inspector_nombre || sdi.inspector_username || "Sin asignar"}</div></td>
              <td>
                <span className={`priority priority-${sdi.prioridad || "media"}`}>
                  <i/>{sdi.prioridad_nombre || sdi.prioridad}
                </span>
              </td>
              <td><span className="status"><i/>{sdi.estado_nombre || sdi.estado}</span></td>


{/* Fecha de emisión de la SDI. */}
<td className="date-cell">{sdi.fecha_emision || "—"}</td>

{/* Acciones disponibles para la solicitud. */}
<td>

  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {/* Editar solo si el usuario tiene permisos y la SDI no está cerrada. */}
    {puedeEditarSdi && sdi.estado !== "cerrada" && (
      <button
        type="button"
        className="button button-outline"
        style={{ padding: "7px 12px", fontSize: 12 }}
        onClick={e => {
          e.stopPropagation();
          abrirEditarSdi(sdi);
        }}
      >
        Editar
      </button>
    )}

    {/* Mantener el botón original para consultar el detalle. */}
    <button
      type="button"
      className="row-more"
      aria-label={`Ver ${sdi.codigo_sdi}`}
      onClick={e => {
        e.stopPropagation();
        setSelectedSdi(sdi);
      }}
    >
      <Icon name="more" size={17}/>
    </button>
  </div>
</td>



            </tr>
          ))}
        </tbody>
      </table>
      {!sdiLoading && !sdiError && visibleSdis.length === 0 && (
        <div className="empty-state">No hay solicitudes SDI para mostrar.</div>
      )}
    </div>
  );

  // Sección reutilizable de solicitudes reales.
  const sdiSection = (
    <div className="card activity-card full-list-card">
      <div className="card-heading">
        <div>
          <h2>Solicitudes de inspección reales</h2>
          <p>Datos consultados desde Django y PostgreSQL · Consulta de estados</p>
        </div>
      </div>
      {sdiLoading && <p>Cargando solicitudes...</p>}
      {sdiError && <p role="alert" style={{ color: "#b42318" }}>{sdiError}</p>}
      {!sdiLoading && sdiTable()}
    </div>
  );

  // Dashboard: indicadores SDI reales y gráficos de demostración.
  const dashboard = (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="live-dot"/> SOLICITUDES DE INSPECCIÓN · DATOS REALES</div>
          <h1>Bienvenido, {session?.name?.split(" ")[0] || "Usuario"} <span>👋</span></h1>
          <p>Aquí tienes el resumen de las solicitudes registradas en Django.</p>
        </div>
        <div className="welcome-actions">
          <button className="button button-outline" onClick={() => setActiveNav("Solicitudes SDI")}>
            <Icon name="clipboard" size={17}/> Consultar solicitudes
          </button>
          <button className="button button-primary" onClick={abrirNuevaSdi}>
            <Icon name="plus" size={18}/> Nueva SDI
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Resumen de SDI reales">
        <Metric label="SDI totales" value={sdiCounts.total} change="Django" note="solicitudes registradas" icon="clipboard" tone="blue"/>
        <Metric label="Pendientes" value={sdiCounts.pending} change="Estado real" note="esperando gestión" icon="calendar" tone="amber"/>
        <Metric label="En proceso" value={sdiCounts.progress} change="Estado real" note="en ejecución" icon="history" tone="violet"/>
        <Metric label="Aprobadas / Cerradas" value={`${sdiCounts.approved} / ${sdiCounts.closed}`} change="Estado real" note="aprobadas y cerradas" icon="check" tone="green"/>
      </section>

      <div style={{ marginBottom: 24 }}>{sdiSection}</div>
      <p className="demo-notice">
        Los gráficos, actividades y trazabilidad que aparecen a continuación son datos de demostración.
        No representan estadísticas reales de SDI.
      </p>

      <section className="middle-grid">
        <div className="card performance-card">
          <div className="card-heading">
            <div><h2>{currentPeriod.title}</h2><p>{currentPeriod.subtitle}</p></div>
            <select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Periodo del gráfico">
              {Object.keys(periods).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="chart-wrap">
            <div className="chart-y"><span>30</span><span>20</span><span>10</span><span>0</span></div>
            <div className="chart">
              <div className="gridline"/><div className="gridline"/>
              <div className="gridline"/><div className="gridline"/>
              <div className="bars">
                {currentPeriod.bars.map(([day, done, pending]) => (
                  <div className="bar-group" key={day}>
                    <div className="bar-pair">
                      <i style={{ height: `${done}%` }}/>
                      <i style={{ height: `${pending}%` }}/>
                    </div>
                    <span>{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-legend">
            <span><i className="legend-blue"/> Completadas</span>
            <span><i className="legend-pale"/> Pendientes</span>
            <small>Gráfico demostrativo</small>
          </div>
        </div>

        <div className="card completion-card">
          <div className="card-heading">
            <div><h2>Estado de actividades</h2><p>{period}</p></div>
            <button className="icon-button" onClick={() => setActiveNav("Actividades")} aria-label="Ver actividades">
              <Icon name="more"/>
            </button>
          </div>
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
            <span><b>Seguimiento del equipo</b><small>Indicadores de demostración.</small></span>
          </div>
        </div>
      </section>

      <section className="bottom-grid">
        <div className="card activity-card">
          <div className="card-heading activity-heading">
            <div><h2>Actividades recientes</h2><p>Organiza y revisa el trabajo del equipo</p></div>
            <button className="text-button" onClick={() => setActiveNav("Actividades")}>
              Ver todas <Icon name="arrow" size={16}/>
            </button>
          </div>
          <ActivityFilters filter={filter} setFilter={setFilter}
            areaFilter={areaFilter} setAreaFilter={setAreaFilter}
            showAreaFilter={showAreaFilter} setShowAreaFilter={setShowAreaFilter}
            areas={areas}/>
          {activityTable(5)}
        </div>
        <TraceCard audit={audit} onOpen={() => setActiveNav("Trazabilidad")}/>
      </section>
    </>
  );

  // ============================================================
  // PANTALLAS DE NAVEGACIÓN
  // ============================================================
  const genericView = () => {
    // Pantalla de SDI reales con botón de creación.
    if (activeNav === "Solicitudes SDI") {
      return (
        <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot"/> BASE DE DATOS REAL</div>
              <h1>Solicitudes SDI</h1>
              <p>
                {sdiCounts.total} solicitudes registradas · {sdiCounts.approved} aprobadas ·{" "}
                {sdiCounts.closed} cerradas · {sdiCounts.rejected} rechazadas ·{" "}
                {sdiCounts.concession} en concesión.
              </p>
            </div>
            <div className="welcome-actions">
              <button className="button button-primary" onClick={abrirNuevaSdi}>
                <Icon name="plus" size={18}/> Nueva SDI
              </button>
            </div>
          </section>
          {sdiSection}
        </>
      );
    }

    // Actividades e inspecciones locales de demostración.
    if (activeNav === "Actividades" || activeNav === "Inspecciones") {
      const esInspeccion = activeNav === "Inspecciones";
      return (
        <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot"/> GESTIÓN OPERATIVA · DEMOSTRACIÓN</div>
              <h1>{activeNav}</h1>
              <p>{esInspeccion ? "Seguimiento de inspecciones de ejemplo." : "Organiza actividades del equipo."}</p>
            </div>
            <div className="welcome-actions">
              <button className="button button-outline" onClick={exportCsv}>
                <Icon name="download" size={17}/> Exportar CSV
              </button>
              <button className="button button-primary"
                onClick={() => openNewItem(esInspeccion ? "Inspección" : "Actividad")}>
                <Icon name="plus" size={18}/> Nueva {esInspeccion ? "inspección" : "actividad"}
              </button>
            </div>
          </section>
          <div className="card activity-card full-list-card">
            <ActivityFilters filter={filter} setFilter={setFilter}
              areaFilter={areaFilter} setAreaFilter={setAreaFilter}
              showAreaFilter={showAreaFilter} setShowAreaFilter={setShowAreaFilter}
              areas={areas}/>
            {activityTable()}
          </div>
        </>
      );
    }

    // Trazabilidad local.
    if (activeNav === "Trazabilidad") {
      return (
        <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot"/> REGISTRO DE CAMBIOS</div>
              <h1>Trazabilidad</h1>
              <p>Historial local de actividades de demostración.</p>
            </div>
            <button className="button button-outline"
              onClick={() => { setAudit([]); notify("Historial de demostración limpiado."); }}>
              <Icon name="history" size={16}/> Limpiar historial demo
            </button>
          </section>
          <div className="card audit-page">
            {audit.length ? audit.map(entry => (
              <div className="audit-row" key={entry.id}>
                <div className={`avatar avatar-small ${entry.color}`}>{entry.initials}</div>
                <div>
                  <strong>{entry.actor}</strong>
                  <span>{entry.action} <button onClick={() => {
                    const item = items.find(i => i.id === entry.itemId);
                    if (item) setSelected(item);
                  }}>{entry.itemId}</button></span>
                  <small>{entry.time}</small>
                </div>
                <span className="timeline-icon">{entry.icon}</span>
              </div>
            )) : <div className="empty-state">No hay movimientos registrados.</div>}
          </div>
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

    // Configuración local.
    return (
      <>
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><span className="live-dot"/> PREFERENCIAS DEL SISTEMA</div>
            <h1>Configuración</h1>
            <p>Personaliza las preferencias de demostración.</p>
          </div>
        </section>
        <div className="card settings-card">
          <h2>Notificaciones</h2>
          <p>Configura los avisos locales del navegador.</p>
          <SettingRow title="Avisos dentro del sistema"
            description="Muestra avisos de actividades de demostración."
            checked={preferences.email}
            onChange={value => setPreferences(p => ({ ...p, email: value }))}/>
          <SettingRow title="Resumen semanal"
            description="Activa el resumen demostrativo."
            checked={preferences.weeklySummary}
            onChange={value => setPreferences(p => ({ ...p, weeklySummary: value }))}/>
          <h2 className="settings-subhead">Visualización</h2>
          <SettingRow title="Vista compacta"
            description="Reduce el espacio entre las filas."
            checked={preferences.compact}
            onChange={value => setPreferences(p => ({ ...p, compact: value }))}/>
          <div className="settings-row">
            <span>
              <strong>Periodo inicial del panel</strong>
              <small>Selecciona el periodo del gráfico de demostración.</small>
            </span>
            <select value={period} onChange={e => setPeriod(e.target.value)}>
              {Object.keys(periods).map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="settings-actions">
            <button className="button button-outline" onClick={() => {
              setPreferences({ email: true, weeklySummary: false, compact: false });
              setPeriod("Esta semana");
              notify("Preferencias restablecidas.");
            }}>Restablecer preferencias</button>
            <button className="button button-primary"
              onClick={() => notify("Preferencias guardadas en este navegador.")}>
              Guardar preferencias
            </button>
          </div>
        </div>
      </>
    );
  };

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
            /* Permite cerrar session sin abrir el menu del perfil */
            <button type="button" className="logout" onClick={doLogout}>
              Cerrar sessión
            </button>
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
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Control de Calidad</span><b>/</b><strong>{activeNav}</strong>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <Icon name="search" size={17}/>
              <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Buscar SDI o actividades..."/>
              <kbd>Ctrl K</kbd>
            </div>
            <div className="notification-wrap">
              <button className="icon-button notification" aria-label="Notificaciones"
                onClick={() => { setNotificationsOpen(v => !v); setProfileOpen(false); }}>
                <Icon name="bell"/>
                {preferences.email && !notificationsRead && <i/>}
              </button>
              {notificationsOpen && (
                <div className="popover notification-popover">
                  <div className="popover-heading">
                    <strong>Notificaciones demo</strong>
                    <button onClick={() => setNotificationsRead(true)}>Marcar leídas</button>
                  </div>
                  {items.filter(i => i.status === "Pendiente").slice(0, 3).map(item => (
                    <button className="notification-item" key={item.id}
                      onClick={() => { setSelected(item); setNotificationsOpen(false); }}>
                      <span className="notification-dot"/>
                      <span><b>{item.kind} pendiente</b><small>{item.title}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="avatar avatar-navy top-avatar profile-trigger"
              aria-label="Abrir perfil" onClick={() => setProfileOpen(v => !v)}>
              {session.name.split(" ").map(p => p[0]).slice(0, 2).join("")}
            </button>
            {/* Cerrar sesión directamente desde la barra superior. */}
            <button type="button" className="button button-outline" onClick={doLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className={`page-content ${preferences.compact ? "compact-content" : ""}`}>
          {activeNav === "Panel de control" ? dashboard : genericView()}
          <footer className="page-footer">
            <span>© 2026 Ancor Tecmin · Control de Calidad</span>
            <span><i/> SDI reales en Django · Otras secciones demostrativas</span>
          </footer>
        </div>
      </main>

      {/* Modal de actividades de demostración. */}
      {showModal && (
        <ItemModal initial={editing} defaultKind={defaultKind}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSubmit={submitItem}/>
      )}

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
      
      {selectedSdi && (
        <SdiDetailModal
            sdi={selectedSdi}
            puedeRegistrarItems={puedeEditarSdi} // Permiso calculado desde Django.
            esInspector={session?.roleCode === "inspector"} // Identifica el rol autenticado.
            onClose={() => setSelectedSdi(null)}
        />
      )}

      {/* Detalle y edición de actividades locales. */}
      {selected && (
        <DetailModal item={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setDefaultKind(selected.kind);
            setSelected(null);
            setShowModal(true);
          }}
          onStatus={status => updateStatus(selected, status)}
          onSaveObservation={observation => {
            const updated = { ...selected, observation };
            setItems(actuales => actuales.map(i => i.id === selected.id ? updated : i));
            setSelected(updated);
            addAudit("actualizó observaciones de", updated);
            notify("Observación guardada.");
          }}
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
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src={logoAncor} alt="ANCOR TECMIN" className="login-logo"/>
        </div>
        <div className="login-kicker">CONTROL DE CALIDAD</div>
        <h1>Bienvenido/a</h1>
        <p>Ingresa con tu cuenta de Control de Calidad.</p>
        <form onSubmit={onLogin}>
          <label>Usuario
            <input name="username" autoComplete="username"
              placeholder="Usuario registrado en Django" required/>
          </label>
          <label>Contraseña
            <input name="password" type="password" autoComplete="current-password"
              placeholder="Ingresa tu contraseña" required/>
          </label>
          {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
          <button className="button button-primary login-submit" type="submit" disabled={loading}>
            {loading ? "Verificando..." : "Iniciar sesión"} <Icon name="arrow" size={16}/>
          </button>
        </form>
        <small className="login-note">Acceso exclusivo para usuarios registrados en ANCOR TECMIN.</small>
      </div>
    </main>
  );
}

// ETAPA 18.3 - Consultar los productos reales asociados a una SDI.
function SdiDetailModal({ sdi, puedeRegistrarItems, esInspector, onClose }) {
  // Estados para almacenar productos, carga y errores.
  const [itemsSDI, setItemsSDI] = useState([]);
  const [cargandoItems, setCargandoItems] = useState(true);
  const [errorItems, setErrorItems] = useState("");
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
    // ETAPA 21.2 - Iniciar una inspección real mediante Django.
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
    setInspeccionActual(null);
  } catch (error) {
    alert(error.message || "No se pudo registrar la inspección visual.");
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
          <div><span>Solicitante</span><b>{sdi.solicitante || "—"}</b></div>
          <div><span>Departamento</span><b>{sdi.departamento_solicitante || "—"}</b></div>
        </div>
        {/* ETAPA 18.4 - Formulario de registro de productos. */}
        {puedeRegistrarItems && (
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
        Código de plano
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
          {/* Mostrar acciones únicamente al inspector. */}
          {esInspector && <th>ACCIÓN</th>}
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
            {esInspector && (
              <td>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={sdi.estado !== "en_proceso"}
                  onClick={() => {
                    setItemEnInspeccion(item); // Seleccionar el producto.
                    setCantidadInspeccion(String(item.cantidad_a_inspeccionar));
                    setObservacionInspeccion("");
                    setErrorInspeccion("");
                  }}
                >
                  Iniciar inspección
                </button>
              </td>
          )}
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
      inspector: Number(form.get("inspector")),
      prioridad: String(form.get("prioridad") || "media"),
      observaciones: String(form.get("observaciones") || "").trim(),
    };
    onSubmit(datosSDI);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={enviarFormulario}
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto" }}>
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
            <input name="departamento_solicitante" maxLength={150}
              placeholder="Ej. Producción" required disabled={guardando}/>
          </label>
          <label>Solicitante
            <input name="solicitante" maxLength={150}
              placeholder="Nombre del solicitante" required disabled={guardando}/>
          </label>
        </div>

        {/* Inspectores cargados dinámicamente desde la API. */}
        <label>Inspector asignado
          <select name="inspector" defaultValue="" required
            disabled={cargandoInspectores || guardando}>
            <option value="">
              {cargandoInspectores ? "Cargando inspectores..." : "Seleccione un inspector"}
            </option>
            {inspectores.filter(inspector => inspector.activo ===true).map(inspector => {
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
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
      <form className="modal" onSubmit={enviarFormulario}
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto" }}>
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


// Filtros para actividades locales.
function ActivityFilters({
  filter, setFilter, areaFilter, setAreaFilter,
  showAreaFilter, setShowAreaFilter, areas,
}) {
  return (
    <div className="table-toolbar">
      <div className="filters">
        {["Todas", "Pendiente", "En proceso", "Completada"].map(state => (
          <button key={state} className={filter === state ? "selected" : ""}
            onClick={() => setFilter(state)}>
            {state}
          </button>
        ))}
      </div>
      <div className="filter-wrap">
        <button className={`filter-button ${areaFilter !== "Todas las áreas" ? "filter-active" : ""}`}
          onClick={() => setShowAreaFilter(!showAreaFilter)}>
          <Icon name="filter" size={16}/>
          {areaFilter === "Todas las áreas" ? "Filtrar área" : areaFilter}
        </button>
        {showAreaFilter && (
          <div className="popover area-popover">
            {areas.map(area => (
              <button key={area} className={area === areaFilter ? "active-option" : ""}
                onClick={() => { setAreaFilter(area); setShowAreaFilter(false); }}>
                {area}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Historial de movimientos locales.
function TraceCard({ audit, onOpen }) {
  return (
    <div className="card trace-card">
      <div className="card-heading">
        <div><h2>Última trazabilidad</h2><p>Movimientos de demostración</p></div>
      </div>
      <div className="timeline">
        {audit.slice(0, 3).map(entry => (
          <div className="timeline-item" key={entry.id}>
            <div className={`avatar avatar-small ${entry.color}`}>{entry.initials}</div>
            <div className="timeline-copy">
              <p><b>{entry.actor}</b> {entry.action} <b>{entry.itemId}</b></p>
              <span>{entry.time}</span>
            </div>
            <span className="timeline-icon">{entry.icon}</span>
          </div>
        ))}
      </div>
      <button className="trace-link" onClick={onOpen}>
        Ver historial completo <Icon name="arrow" size={15}/>
      </button>
    </div>
  );
}

// Formulario local de actividades e inspecciones de ejemplo.
function ItemModal({ initial, defaultKind, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={onSubmit} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-icon"><Icon name={initial ? "clipboard" : "plus"}/></div>
            <h2>{initial ? "Editar actividad" : "Nueva actividad"}</h2>
            <p>Formulario de demostración, sin registro en PostgreSQL.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close"/>
          </button>
        </div>
        <label>Nombre de la actividad
          <input name="title" required autoFocus defaultValue={initial?.title}
            placeholder="Ej. Inspección de equipos..."/>
        </label>
        <div className="form-row">
          <label>Tipo
            <select name="kind" defaultValue={initial?.kind || defaultKind}>
              <option>Actividad</option><option>Inspección</option>
            </select>
          </label>
          <label>Prioridad
            <select name="priority" defaultValue={initial?.priority || "Media"}>
              <option>Media</option><option>Alta</option><option>Baja</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Área
            <input name="area" required defaultValue={initial?.area} placeholder="Ej. Planta Norte"/>
          </label>
          <label>Responsable
            <input name="owner" required defaultValue={initial?.owner} placeholder="Nombre y apellido"/>
          </label>
        </div>
        <label>Observaciones
          <textarea name="observation" rows="3" defaultValue={initial?.observation}/>
        </label>
        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button button-primary">
            {initial ? "Guardar cambios" : "Crear actividad"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Detalle de actividades locales.
function DetailModal({ item, onClose, onEdit, onStatus, onSaveObservation }) {
  const [observation, setObservation] = useState(item.observation || "");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal detail-modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: "90vh",  // Limitar la altura al 90 % de la pantalla.
          overflowY: "auto",  // Permitir desplazamiento vertical.
        }}
>
        <div className="modal-head">
          <div>
            <span className="detail-id">{item.id} · {item.kind}</span>
            <h2>{item.title}</h2><p>{item.area} · {item.date}</p>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close"/>
          </button>
        </div>
        <div className="detail-grid">
          <div><span>Responsable</span><b>{item.owner}</b></div>
          <div><span>Prioridad</span><b>{item.priority}</b></div>
          <div>
            <span>Estado actual</span>
            <select value={item.status} onChange={e => onStatus(e.target.value)}>
              <option>Pendiente</option><option>En proceso</option><option>Completada</option>
            </select>
          </div>
        </div>
        <div className="detail-history">
          <strong>Observaciones y evidencia</strong>
          <textarea rows="3" value={observation}
            onChange={e => setObservation(e.target.value)}/>
          <button className="button button-outline"
            onClick={() => onSaveObservation(observation)}>
            Guardar observación
          </button>
        </div>
        <div className="modal-actions">
          <button className="button button-outline" onClick={onEdit}>Editar actividad</button>
          <button className="button button-primary" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}


/**
 * ETAPA 17.14 - Formulario de registro de inspectores.
 * Envía los datos a Django mediante inviteMember().
 */

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
