
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
  obtenerInspeccionVisual, // Consultar los siete criterios visuales.
  obtenerInspeccionesItem, // ETAPA 21.4 - Recuperar inspecciones existentes.
  subirEvidenciaInspeccion, // ETAPA 22 - Subir fotografías a Django.
  obtenerEvidenciasInspeccion, // ETAPA 22 - Consultar evidencias registradas.
  aprobarInspeccion,
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
  const [period, setPeriod] = useState(() => readJson("ancor.demo.period.v1", "Esta semana"));
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

// Dashboard: solicitudes e indicadores calculados desde Django.
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
      <section className="middle-grid">
        <div className="card completion-card">
          <div>
            <div><h2>Estado de solicitudes</h2>
            <p>Resumen general</p>
            </div>
            <button 
            className="icon-button" 
            onClick={() => setActiveNav("Solicitudes SDI")} 
            aria-label="Ver solicitudes 
            SDI">
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
            <span><b>Control de calidad</b><small>Indicadores obtenidos de la SDI registradas.</small></span>
          </div>
        </div>
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
           {/* Permite cerrar sesión sin abrir el menú del perfil. */}
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
      
      {selectedSdi && (
        <SdiDetailModal
            sdi={selectedSdi}
            puedeRegistrarItems={puedeEditarSdi} // Permiso calculado desde Django.
            esInspector={session?.roleCode === "inspector"} // Identifica el rol autenticado.
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
  // ETAPA 25.1 - Controla la pestaña activa del detalle SDI.
  const [pestanaActiva, setPestanaActiva] = useState("productos");
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
          <div><span>Solicitante</span><b>{sdi.solicitante || "—"}</b></div>
          <div><span>Departamento</span><b>{sdi.departamento_solicitante || "—"}</b></div>
        </div>
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
