import React, { useEffect, useMemo, useRef, useState } from 'react';
import logoAncor from "./assets/Logotipo ANCOR TECMIN.png";

const seedItems = [
  { id: 'INS-0248', title: 'Inspección de soldadura · Línea 04', area: 'Planta Norte', owner: 'Carlos Muñoz', initials: 'CM', priority: 'Alta', status: 'En proceso', date: 'Hoy, 10:30', kind: 'Inspección', observation: 'Revisar el cordón de soldadura en la unión norte.' },
  { id: 'ACT-0247', title: 'Revisar certificados de material', area: 'Recepción', owner: 'Daniela Rojas', initials: 'DR', priority: 'Media', status: 'Pendiente', date: 'Hoy, 12:00', kind: 'Actividad', observation: '' },
  { id: 'INS-0246', title: 'Control dimensional · Pieza M-82', area: 'Taller Mecánico', owner: 'Felipe Soto', initials: 'FS', priority: 'Alta', status: 'En proceso', date: 'Hoy, 14:00', kind: 'Inspección', observation: '' },
  { id: 'ACT-0245', title: 'Actualizar registro de calibración', area: 'Laboratorio', owner: 'Valentina Pérez', initials: 'VP', priority: 'Baja', status: 'Pendiente', date: 'Mañana, 09:00', kind: 'Actividad', observation: '' },
  { id: 'INS-0244', title: 'Inspección visual de estructura', area: 'Planta Sur', owner: 'Carlos Muñoz', initials: 'CM', priority: 'Media', status: 'Completada', date: 'Ayer, 16:20', kind: 'Inspección', observation: 'Inspección completada sin observaciones.' },
];

const seedAudit = [
  { id: 1, initials: 'CM', color: 'blue', actor: 'Carlos Muñoz', action: 'actualizó el estado de', itemId: 'INS-0248', time: 'Hace 12 min', icon: '↻' },
  { id: 2, initials: 'DR', color: 'purple', actor: 'Daniela Rojas', action: 'agregó una observación a', itemId: 'ACT-0247', time: 'Hace 38 min', icon: '✎' },
  { id: 3, initials: 'FS', color: 'green', actor: 'Felipe Soto', action: 'completó', itemId: 'INS-0244', time: 'Hace 1 h', icon: '✓' },
];

const team = [
  { initials: 'GW', name: 'Guilbaud Wilcinot', role: 'Analista funcional y líder de integración', color: 'navy' },
  { initials: 'CM', name: 'Carlos Muñoz', role: 'Desarrollador Backend y Base de Datos', color: 'blue' },
  { initials: 'DR', name: 'Daniela Rojas', role: 'Desarrolladora Frontend, UX y QA', color: 'purple' },
  { initials: 'FS', name: 'Felipe Soto', role: 'Inspector de calidad', color: 'green' },
];

const periods = {
  'Esta semana': {
    title: 'Rendimiento semanal', subtitle: 'Seguimiento de actividades del equipo',
    bars: [['Lun', 38, 20], ['Mar', 54, 32], ['Mié', 45, 25], ['Jue', 72, 42], ['Vie', 58, 34], ['Sáb', 27, 12], ['Dom', 18, 8]],
    total: 42, completed: 26, pending: 10, progress: 6, completion: 62,
  },
  'Este mes': {
    title: 'Rendimiento mensual', subtitle: 'Resumen de las últimas semanas',
    bars: [['Sem 1', 42, 28], ['Sem 2', 58, 32], ['Sem 3', 48, 36], ['Sem 4', 78, 40], ['Sem 5', 63, 24]],
    total: 248, completed: 178, pending: 25, progress: 45, completion: 72,
  },
  'Últimos 7 días': {
    title: 'Últimos 7 días', subtitle: 'Actividad día por día',
    bars: [['Vie', 38, 20], ['Sáb', 54, 32], ['Dom', 45, 25], ['Lun', 72, 42], ['Mar', 58, 34], ['Mié', 27, 12], ['Jue', 66, 30]],
    total: 42, completed: 29, pending: 8, progress: 5, completion: 69,
  },
};

function readJson(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}

function Icon({ name, size = 19 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M8 11h8M8 15h5"/></>,
    check: <><path d="M8 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m8 13 2.5 2.5L16 10"/></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8a4 4 0 0 1-2 3.5M22 21v-2a4 4 0 0 0-3-3.87"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4L7 15a8 8 0 0 1 0-2l-1.4-1.1L7 9.5l1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4L19.4 13a8 8 0 0 1 0 2Z"/></>,
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
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const [items, setItems] = useState(() => readJson('ancor.demo.activities.v1', seedItems));
  const [members, setMembers] = useState(() => readJson('ancor.demo.team.v1', team));
  const [audit, setAudit] = useState(() => readJson('ancor.demo.audit.v1', seedAudit));
  const [session, setSession] = useState(() => readJson('ancor.demo.session.v1', { name: 'Guilbaud Wilcinot', email: 'gu.wilcinot@duocuc.cl', role: 'Administrador' }));
  const [activeNav, setActiveNav] = useState('Panel de control');
  const [period, setPeriod] = useState(() => readJson('ancor.demo.period.v1', 'Esta semana'));
  const [defaultKind, setDefaultKind] = useState('Actividad');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [areaFilter, setAreaFilter] = useState('Todas las áreas');
  const [showAreaFilter, setShowAreaFilter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [preferences, setPreferences] = useState(() => readJson('ancor.demo.preferences.v1', { email: true, weeklySummary: false, compact: false }));
  const [collapsed, setCollapsed] = useState(false);
  const searchRef = useRef(null);

  const currentPeriod = periods[period];
  const periodCounts = {
    pending: Math.max(0, currentPeriod.pending + items.filter(item => item.status === 'Pendiente').length - 2),
    progress: Math.max(0, currentPeriod.progress + items.filter(item => item.status === 'En proceso').length - 2),
    completed: Math.max(0, currentPeriod.completed + items.filter(item => item.status === 'Completada').length - 1),
  };
  periodCounts.total = periodCounts.pending + periodCounts.progress + periodCounts.completed;
  periodCounts.completion = periodCounts.total ? Math.round(periodCounts.completed / periodCounts.total * 100) : 0;
  periodCounts.progressPercent = periodCounts.total ? Math.round(periodCounts.progress / periodCounts.total * 100) : 0;
  periodCounts.pendingPercent = Math.max(0, 100 - periodCounts.completion - periodCounts.progressPercent);
  const areas = useMemo(() => ['Todas las áreas', ...new Set(items.map(item => item.area))], [items]);
  const visibleItems = useMemo(() => items.filter(item => {
    const matchesQuery = `${item.id} ${item.title} ${item.owner} ${item.area}`.toLowerCase().includes(query.toLowerCase());
    const matchesState = filter === 'Todas' || item.status === filter;
    const matchesArea = areaFilter === 'Todas las áreas' || item.area === areaFilter;
    const matchesKind = activeNav !== 'Inspecciones' || item.kind === 'Inspección';
    return matchesQuery && matchesState && matchesArea && matchesKind;
  }), [items, query, filter, areaFilter, activeNav]);

  useEffect(() => { localStorage.setItem('ancor.demo.activities.v1', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('ancor.demo.team.v1', JSON.stringify(members)); }, [members]);
  useEffect(() => { localStorage.setItem('ancor.demo.audit.v1', JSON.stringify(audit)); }, [audit]);
  useEffect(() => { localStorage.setItem('ancor.demo.preferences.v1', JSON.stringify(preferences)); }, [preferences]);
  useEffect(() => { localStorage.setItem('ancor.demo.period.v1', JSON.stringify(period)); }, [period]);
  useEffect(() => { localStorage.setItem('ancor.demo.session.v1', JSON.stringify(session)); }, [session]);
  useEffect(() => {
    const handleShortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const notify = (message) => { setToast(message); window.clearTimeout(notify.timeout); notify.timeout = window.setTimeout(() => setToast(''), 2800); };
  const changePeriod = value => { setPeriod(value); if (preferences.weeklySummary) notify(`Resumen de demostración actualizado: ${value.toLowerCase()}.`); };
  const addAudit = (action, item) => {
    setAudit(current => [{ id: Date.now(), initials: session?.name?.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'GW', color: 'blue', actor: session?.name || 'Usuario demo', action, itemId: item.id, time: 'Ahora', icon: '↻' }, ...current]);
  };
  const submitItem = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const owner = String(data.get('owner')).trim();
    const initials = owner.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
    const formItem = { title: String(data.get('title')).trim(), area: String(data.get('area')).trim(), owner, initials, priority: data.get('priority'), kind: data.get('kind'), observation: String(data.get('observation') || '').trim() };
    if (editing) {
      const updated = { ...editing, ...formItem };
      setItems(current => current.map(item => item.id === editing.id ? updated : item));
      addAudit('editó', updated); setSelected(updated); notify('Cambios guardados.');
    } else {
      const nextNumber = Math.max(248, ...items.map(item => Number(item.id.match(/\d+$/)?.[0] || 0))) + 1;
      const item = { id: `${formItem.kind === 'Inspección' ? 'INS' : 'ACT'}-${nextNumber}`, ...formItem, status: 'Pendiente', date: 'Hoy, 16:00' };
      setItems(current => [item, ...current]); setFilter('Todas'); setAreaFilter('Todas las áreas'); setNotificationsRead(false); addAudit('creó', item); notify('Actividad creada y asignada.');
    }
    setEditing(null); setShowModal(false);
  };
  const updateStatus = (item, status) => {
    const updated = { ...item, status };
    setItems(current => current.map(entry => entry.id === item.id ? updated : entry));
    if (status === 'Pendiente') setNotificationsRead(false);
    setSelected(updated); addAudit(`cambió el estado a “${status}” de`, updated); notify(`Estado actualizado: ${status.toLowerCase()}.`);
  };
  const exportCsv = () => {
    const rows = [['ID', 'Tipo', 'Actividad', 'Área', 'Responsable', 'Prioridad', 'Estado', 'Fecha', 'Observaciones'], ...visibleItems.map(item => [item.id, item.kind, item.title, item.area, item.owner, item.priority, item.status, item.date, item.observation || ''])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `actividades-calidad-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Archivo CSV descargado.');
  };
  const doLogin = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim();
    const rawName = String(data.get('name') || '').trim();
    const name = rawName || (email.split('@')[0] === 'gu.wilcinot' ? 'Guilbaud Wilcinot' : email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()));
    setSession({ name, email, role: email === 'gu.wilcinot@duocuc.cl' ? 'Administrador' : 'Inspector' });
    setActiveNav('Panel de control'); setNotificationsRead(false); notify(`Bienvenido/a, ${name}.`);
  };
  const inviteMember = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    const email = String(data.get('email')).trim();
    const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    setMembers(current => [{ initials, name, email, role: data.get('role'), color: 'blue', status: 'Invitación enviada' }, ...current]);
    setShowInviteModal(false); notify(`Invitación de demostración registrada para ${name}.`);
  };

  const nav = [
    { label: 'GENERAL', links: [{ name: 'Panel de control', icon: 'grid' }, { name: 'Actividades', icon: 'clipboard', count: String(items.filter(i => i.status !== 'Completada').length) }, { name: 'Inspecciones', icon: 'check' }, { name: 'Trazabilidad', icon: 'history' }] },
    { label: 'GESTIÓN', links: [{ name: 'Equipo', icon: 'users' }, { name: 'Configuración', icon: 'settings' }] },
  ];

  if (!session) return <Login onLogin={doLogin}/>;

  const openNewItem = (kind = 'Actividad') => { setEditing(null); setSelected(null); setShowModal(true); setDefaultKind(kind); };

  const activityTable = (limit = Infinity) => <div className="table-scroll"><table><thead><tr><th>ACTIVIDAD</th><th>RESPONSABLE</th><th>PRIORIDAD</th><th>ESTADO</th><th>FECHA</th><th/></tr></thead><tbody>{visibleItems.slice(0, limit).map(item => <tr key={item.id} onClick={() => setSelected(item)}><td><div className="task-name"><span className={`task-icon ${item.kind === 'Inspección' ? 'inspect' : ''}`}>{item.kind === 'Inspección' ? '⌕' : '▤'}</span><span><strong>{item.title}</strong><small>{item.id} <i/> {item.area}</small></span></div></td><td><div className="owner"><div className="avatar avatar-small">{item.initials}</div>{item.owner}</div></td><td><span className={`priority priority-${item.priority.toLowerCase()}`}><i/>{item.priority}</span></td><td><Status status={item.status}/></td><td className="date-cell">{item.date}</td><td><button className="row-more" aria-label={`Ver ${item.id}`} onClick={e => { e.stopPropagation(); setSelected(item); }}><Icon name="more" size={17}/></button></td></tr>)}</tbody></table>{visibleItems.length === 0 && <div className="empty-state">No encontramos registros con esos criterios. Prueba cambiando los filtros.</div>}</div>;

  const dashboard = <>
    <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> JUEVES, 1 DE OCTUBRE DE 2026 <span className="demo-label">DATOS DE DEMOSTRACIÓN</span></div><h1>Buenos días, {session.name.split(' ')[0]} <span>👋</span></h1><p>Aquí tienes el resumen de las actividades de Control de Calidad.</p></div><div className="welcome-actions"><button className="button button-outline" onClick={exportCsv}><Icon name="download" size={17}/> Exportar CSV</button><button className="button button-primary" onClick={() => openNewItem()}><Icon name="plus" size={18}/> Nueva actividad</button></div></section>
    <section className="metric-grid" aria-label="Resumen de actividades">
      <Metric label="Actividades totales" value={periodCounts.total} change="12%" note={`en ${period.toLowerCase()}`} icon="clipboard" tone="blue" data={[24,31,26,42,36,53,48,67,58,74,64,85]}/>
      <Metric label="Pendientes" value={periodCounts.pending} change="3 menos" note="vs. período anterior" icon="calendar" tone="amber" data={[70,65,76,61,68,47,55,42,51,37,41,30]} down/>
      <Metric label="En proceso" value={periodCounts.progress} change="En curso" note="asignadas al equipo" icon="history" tone="violet" data={[28,37,32,49,45,39,58,53,67,58,72,66]}/>
      <Metric label="Completadas" value={periodCounts.completed} change={`${periodCounts.completion}%`} note="tasa de cumplimiento" icon="check" tone="green" data={[20,29,24,37,35,48,44,57,53,70,66,82]}/>
    </section>
    <section className="middle-grid">
      <div className="card performance-card"><div className="card-heading"><div><h2>{currentPeriod.title}</h2><p>{currentPeriod.subtitle}</p></div><select value={period} onChange={e => changePeriod(e.target.value)} aria-label="Periodo del gráfico">{Object.keys(periods).map(value => <option key={value}>{value}</option>)}</select></div><div className="chart-wrap"><div className="chart-y"><span>30</span><span>20</span><span>10</span><span>0</span></div><div className="chart"><div className="gridline"/><div className="gridline"/><div className="gridline"/><div className="gridline"/><div className="bars">{currentPeriod.bars.map(([day, done, pending]) => <div className="bar-group" key={day}><div className="bar-pair"><i style={{height:`${done}%`}}/><i style={{height:`${pending}%`}}/></div><span>{day}</span></div>)}</div></div></div><div className="chart-legend"><span><i className="legend-blue"/> Completadas</span><span><i className="legend-pale"/> Pendientes</span><small><b>↑ 8.2%</b> respecto al período anterior</small></div></div>
      <div className="card completion-card"><div className="card-heading"><div><h2>Estado de actividades</h2><p>{period}</p></div><button className="icon-button" aria-label="Más opciones" onClick={() => setActiveNav('Actividades')}><Icon name="more"/></button></div><div className="donut-area"><div className="donut" style={{background:`conic-gradient(#267ab5 0 ${periodCounts.completion}%,#9080d3 ${periodCounts.completion}% ${periodCounts.completion + periodCounts.progressPercent}%,#e5eaf0 ${periodCounts.completion + periodCounts.progressPercent}% 100%)`}}><div><strong>{periodCounts.total}</strong><span>Total</span></div></div><div className="donut-center-label"><span><i className="dot-blue"/>Completadas <b>{periodCounts.completion}%</b></span><span><i className="dot-violet"/>En proceso <b>{periodCounts.progressPercent}%</b></span><span><i className="dot-gray"/>Pendientes <b>{periodCounts.pendingPercent}%</b></span></div></div><div className="completion-foot"><span className="tiny-check">✓</span><span><b>Buen trabajo del equipo</b><small>El cumplimiento subió 8.2% en este período.</small></span></div></div>
    </section>
    <section className="bottom-grid">
      <div className="card activity-card"><div className="card-heading activity-heading"><div><h2>Actividades recientes</h2><p>Organiza y revisa el trabajo del equipo</p></div><button className="text-button" onClick={() => setActiveNav('Actividades')}>Ver todas <Icon name="arrow" size={16}/></button></div><ActivityFilters filter={filter} setFilter={setFilter} showAreaFilter={showAreaFilter} setShowAreaFilter={setShowAreaFilter} areaFilter={areaFilter} setAreaFilter={setAreaFilter} areas={areas}/>{activityTable(5)}</div>
      <TraceCard audit={audit} onOpen={() => setActiveNav('Trazabilidad')}/>
    </section>
  </>;

  const genericView = () => {
    if (activeNav === 'Ayuda') return <><section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> GUÍA RÁPIDA</div><h1>Ayuda</h1><p>Cómo probar las funciones de esta versión local.</p></div></section><div className="card help-page"><h2>Comienza por el panel</h2><p>Usa el selector del gráfico para cambiar entre semana, mes y últimos 7 días. El botón Nueva actividad permite registrar tareas e inspecciones de muestra.</p><h2>Gestiona los registros</h2><p>En Actividades o Inspecciones puedes buscar, filtrar por estado o área, abrir el detalle, cambiar el estado y guardar observaciones. Exportar CSV descarga los resultados filtrados.</p><h2>Sesión de demostración</h2><p>Abre el menú de tu perfil para cerrar sesión. En la pantalla de acceso puedes iniciar otra sesión ficticia con cualquier contraseña.</p><div className="demo-notice">Los cambios se guardan en el almacenamiento local de este navegador; no se envían a un servidor.</div></div></>;
    if (activeNav === 'Actividades' || activeNav === 'Inspecciones') {
      const isInspection = activeNav === 'Inspecciones';
      return <><section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> GESTIÓN OPERATIVA</div><h1>{activeNav}</h1><p>{isInspection ? 'Registra y sigue las inspecciones de Control de Calidad.' : 'Asigna responsables, prioridades y fechas a las tareas del equipo.'}</p></div><div className="welcome-actions"><button className="button button-outline" onClick={exportCsv}><Icon name="download" size={17}/> Exportar CSV</button><button className="button button-primary" onClick={() => openNewItem(isInspection ? 'Inspección' : 'Actividad')}><Icon name="plus" size={18}/> Nueva {isInspection ? 'inspección' : 'actividad'}</button></div></section><div className="card activity-card full-list-card"><ActivityFilters filter={filter} setFilter={setFilter} showAreaFilter={showAreaFilter} setShowAreaFilter={setShowAreaFilter} areaFilter={areaFilter} setAreaFilter={setAreaFilter} areas={areas}/>{activityTable()}</div></>;
    }
    if (activeNav === 'Trazabilidad') return <><section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> REGISTRO DE CAMBIOS</div><h1>Trazabilidad</h1><p>Historial local de cambios realizados en este navegador.</p></div><button className="button button-outline" onClick={() => { setAudit([]); notify('Se limpió el historial de demostración.'); }}><Icon name="history" size={16}/> Limpiar historial demo</button></section><div className="card audit-page">{audit.length ? audit.map(entry => <div className="audit-row" key={entry.id}><div className={`avatar avatar-small ${entry.color}`}>{entry.initials}</div><div><strong>{entry.actor}</strong><span>{entry.action} <button onClick={() => { const item = items.find(i => i.id === entry.itemId); if (item) setSelected(item); }}>{entry.itemId}</button></span><small>{entry.time}</small></div><span className="timeline-icon">{entry.icon}</span></div>) : <div className="empty-state">Aún no hay movimientos. Crea una actividad o actualiza un estado para ver eventos aquí.</div>}</div></>;
    if (activeNav === 'Equipo') return <><section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> PERSONAS Y RESPONSABILIDADES</div><h1>Equipo</h1><p>Integrantes y roles de demostración para el área.</p></div><button className="button button-primary" onClick={() => setShowInviteModal(true)}>+ Invitar integrante</button></section><div className="team-grid">{members.map(person => <div className="card team-card" key={person.email || person.name}><div className={`avatar ${person.color}`}>{person.initials}</div><div><strong>{person.name}</strong><span>{person.role}</span>{person.email && <small>{person.email}</small>}</div><span className={`team-active ${person.status ? 'team-invited' : ''}`}><i/> {person.status || 'Activo'}</span></div>)}</div><div className="demo-notice">Los perfiles son datos ficticios de demostración; los nombres reales del equipo están pendientes de confirmación en el anteproyecto.</div></>;
    return <><section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> PREFERENCIAS DEL SISTEMA</div><h1>Configuración</h1><p>Personaliza cómo se comporta esta vista de demostración.</p></div></section><div className="card settings-card"><h2>Notificaciones</h2><p>Elige qué avisos simulados quieres ver.</p><SettingRow title="Avisos dentro del sistema" description="Muestra notificaciones de cambios y nuevas asignaciones." checked={preferences.email} onChange={value => setPreferences(current => ({ ...current, email: value }))}/><SettingRow title="Resumen semanal" description="Activa un aviso demostrativo al revisar el panel semanal." checked={preferences.weeklySummary} onChange={value => setPreferences(current => ({ ...current, weeklySummary: value }))}/><h2 className="settings-subhead">Visualización</h2><SettingRow title="Vista compacta" description="Reduce el espacio entre las filas de actividades." checked={preferences.compact} onChange={value => { setPreferences(current => ({ ...current, compact: value })) }}/><div className="settings-row"><span><strong>Periodo inicial del panel</strong><small>Selecciona el periodo que se muestra al abrir el panel.</small></span><select value={period} onChange={e => changePeriod(e.target.value)}>{Object.keys(periods).map(value => <option key={value}>{value}</option>)}</select></div><div className="settings-actions"><button className="button button-outline" onClick={() => { const defaults = { email: true, weeklySummary: false, compact: false }; setPreferences(defaults); setPeriod('Esta semana'); notify('Preferencias restablecidas.'); }}>Restablecer preferencias</button><button className="button button-primary" onClick={() => notify('Preferencias guardadas en este navegador.')}>Guardar preferencias</button></div></div></>;
  };

  return <div className="app-shell">
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="brand"><img src={logoAncor} alt="Ancor Tecmin" className="brand-logo"/><button className="collapse" aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} onClick={() => setCollapsed(value => !value)}>{collapsed ? '›' : '‹'}</button></div>
      <div className="workspace"><div className="workspace-icon">AC</div><div className="workspace-copy"><span>Espacio de trabajo</span><strong>Control de Calidad</strong></div><span className="chevron">⌄</span></div>
      <nav>{nav.map(group => <div className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.links.map(link => <button key={link.name} onClick={() => { setActiveNav(link.name); setProfileOpen(false); }} className={`nav-link ${activeNav === link.name ? 'active' : ''}`}><Icon name={link.icon}/><span>{link.name}</span>{link.count && <small className="nav-count">{link.count}</small>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon">✦</div><strong>¿Necesitas ayuda?</strong><span>Revisa la guía rápida para comenzar.</span><button onClick={() => setActiveNav('Ayuda')}>Ver guía <Icon name="arrow" size={15}/></button></div><div className="profile"><div className="avatar avatar-navy">{session.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="profile-copy"><strong>{session.name}</strong><span>{session.role}</span></div><button className="icon-button" aria-label="Opciones de perfil" onClick={() => setProfileOpen(!profileOpen)}><Icon name="more"/></button>{profileOpen && <div className="popover profile-popover"><strong>{session.name}</strong><span>{session.email}</span><button onClick={() => { setProfileOpen(false); notify('Estás usando el perfil de demostración.'); }}>Mi perfil</button><button className="logout-action" onClick={() => { setSession(null); setProfileOpen(false); }}><Icon name="logout" size={16}/> Cerrar sesión</button></div>}</div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Control de Calidad</span><b>/</b><strong>{activeNav}</strong></div><div className="top-actions"><div className="search-box"><Icon name="search" size={17}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar actividades..."/><kbd>⌘ K</kbd></div><div className="notification-wrap"><button className="icon-button notification" aria-label="Notificaciones" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}><Icon name="bell"/>{preferences.email && !notificationsRead && <i/>}</button>{notificationsOpen && <div className="popover notification-popover"><div className="popover-heading"><strong>Notificaciones</strong><button onClick={() => setNotificationsRead(true)}>Marcar leídas</button></div>{items.filter(item => item.status === 'Pendiente').slice(0, 3).map(item => <button className="notification-item" key={item.id} onClick={() => { setSelected(item); setNotificationsOpen(false); }}><span className="notification-dot"/><span><b>{item.kind} pendiente</b><small>{item.title}</small></span></button>)}{!items.some(item => item.status === 'Pendiente') && <p className="empty-notifications">No tienes pendientes de revisión.</p>}</div>}</div><button className="avatar avatar-navy top-avatar profile-trigger" aria-label="Abrir perfil" onClick={() => setProfileOpen(!profileOpen)}>{session.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</button></div></header>
      {profileOpen && <div className="popover top-profile-menu"><strong>{session.name}</strong><span>{session.email}</span><button onClick={() => notify('Estás usando el perfil de demostración.')}>Mi perfil</button><button className="logout-action" onClick={() => { setSession(null); setProfileOpen(false); }}><Icon name="logout" size={16}/> Cerrar sesión</button></div>}
      <div className={`page-content ${preferences.compact ? 'compact-content' : ''}`}>
        {activeNav === 'Panel de control' ? dashboard : genericView()}
        <footer className="page-footer"><span>© 2026 Ancor Tecmin · Control de Calidad</span><span><i/> Datos locales de demostración <b>·</b> Se guardan en este navegador</span></footer>
      </div>
    </main>
    {showModal && <ItemModal initial={editing} defaultKind={defaultKind} onClose={() => { setShowModal(false); setEditing(null); }} onSubmit={submitItem}/>}
    {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} onSubmit={inviteMember}/>}
    {selected && <DetailModal item={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setDefaultKind(selected.kind); setSelected(null); setShowModal(true); }} onStatus={status => updateStatus(selected, status)} onSaveObservation={observation => { const updated = { ...selected, observation }; setItems(current => current.map(entry => entry.id === selected.id ? updated : entry)); setSelected(updated); addAudit('actualizó observaciones de', updated); notify('Observación guardada.'); }}/>} 
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

function Login({ onLogin }) {
  return <main className="login-page"><div className="login-card"><div className="login-brand"><div className="brand-mark"><span/><span/><span/><span/></div><div><strong>ancor<span>.</span></strong><small>TECMin · CALIDAD</small></div></div><div className="login-kicker">CONTROL DE CALIDAD</div><h1>Bienvenido/a</h1><p>Inicia una sesión de demostración para continuar.</p><form onSubmit={onLogin}><label>Nombre<input name="name" placeholder="Tu nombre (opcional)"/></label><label>Correo electrónico<input name="email" type="email" placeholder="nombre@empresa.cl" required defaultValue="gu.wilcinot@duocuc.cl"/></label><label>Contraseña de demostración<input name="password" type="password" placeholder="Escribe cualquier contraseña" required/></label><button className="button button-primary login-submit" type="submit">Iniciar sesión <Icon name="arrow" size={16}/></button></form><small className="login-note">Modo demo: se acepta cualquier contraseña. No se envían ni guardan credenciales.</small></div></main>;
}

function ActivityFilters({ filter, setFilter, showAreaFilter, setShowAreaFilter, areaFilter, setAreaFilter, areas }) {
  return <div className="table-toolbar"><div className="filters">{['Todas','Pendiente','En proceso','Completada'].map(state => <button key={state} className={filter === state ? 'selected' : ''} onClick={() => setFilter(state)}>{state}</button>)}</div><div className="filter-wrap"><button className={`filter-button ${areaFilter !== 'Todas las áreas' ? 'filter-active' : ''}`} onClick={() => setShowAreaFilter(!showAreaFilter)}><Icon name="filter" size={16}/> {areaFilter === 'Todas las áreas' ? 'Filtrar área' : areaFilter}</button>{showAreaFilter && <div className="popover area-popover">{areas.map(area => <button className={area === areaFilter ? 'active-option' : ''} key={area} onClick={() => { setAreaFilter(area); setShowAreaFilter(false); }}>{area}</button>)}</div>}</div></div>;
}

function TraceCard({ audit, onOpen }) {
  return <div className="card trace-card"><div className="card-heading"><div><h2>Última trazabilidad</h2><p>Movimientos recientes</p></div></div><div className="timeline">{audit.slice(0, 3).map(entry => <div className="timeline-item" key={entry.id}><div className={`avatar avatar-small ${entry.color}`}>{entry.initials}</div><div className="timeline-copy"><p><b>{entry.actor}</b> {entry.action} <b>{entry.itemId}</b></p><span>{entry.time}</span></div><span className="timeline-icon">{entry.icon}</span></div>)}</div><button className="trace-link" onClick={onOpen}>Ver historial completo <Icon name="arrow" size={15}/></button></div>;
}

function InviteModal({ onClose, onSubmit }) {
  return <div className="modal-backdrop" onClick={onClose}><form className="modal" onSubmit={onSubmit} onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="modal-icon"><Icon name="users"/></div><h2>Invitar integrante</h2><p>Registra una invitación de muestra para el equipo.</p></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close"/></button></div><label>Nombre completo<input name="name" placeholder="Nombre y apellido" required autoFocus/></label><label>Correo electrónico<input name="email" type="email" placeholder="nombre@empresa.cl" required/></label><label>Rol<select name="role"><option>Inspector de calidad</option><option>Analista funcional y líder de integración</option><option>Desarrollador Backend y Base de Datos</option><option>Desarrollador Frontend, UX y QA</option></select></label><div className="demo-notice">No se enviará un correo real. La invitación se agrega a la lista de este navegador.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Registrar invitación</button></div></form></div>;
}

function ItemModal({ initial, defaultKind, onClose, onSubmit }) {
  return <div className="modal-backdrop" onClick={onClose}><form className="modal" onSubmit={onSubmit} onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="modal-icon"><Icon name={initial ? 'clipboard' : 'plus'}/></div><h2>{initial ? 'Editar registro' : 'Nueva actividad'}</h2><p>{initial ? `Actualiza los datos de ${initial.id}.` : 'Registra una actividad o inspección para el equipo.'}</p></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close"/></button></div><label>Nombre de la actividad<input name="title" placeholder="Ej. Inspección de equipos..." required autoFocus defaultValue={initial?.title}/></label><div className="form-row"><label>Tipo<select name="kind" defaultValue={initial?.kind || defaultKind}><option>Actividad</option><option>Inspección</option></select></label><label>Prioridad<select name="priority" defaultValue={initial?.priority || 'Media'}><option>Media</option><option>Alta</option><option>Baja</option></select></label></div><div className="form-row"><label>Área<input name="area" placeholder="Ej. Planta Norte" required defaultValue={initial?.area}/></label><label>Responsable<input name="owner" placeholder="Nombre y apellido" required defaultValue={initial?.owner}/></label></div><label>Observaciones<textarea name="observation" rows="3" placeholder="Notas o evidencia relevante..." defaultValue={initial?.observation}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">{initial ? 'Guardar cambios' : <><Icon name="plus" size={17}/> Crear actividad</>}</button></div></form></div>;
}

function DetailModal({ item, onClose, onEdit, onStatus, onSaveObservation }) {
  const [observation, setObservation] = useState(item.observation || '');
  return <div className="modal-backdrop" onClick={onClose}><div className="modal detail-modal" onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="detail-id">{item.id} · {item.kind}</span><h2>{item.title}</h2><p>{item.area} · {item.date}</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><Icon name="close"/></button></div><div className="detail-grid"><div><span>Responsable</span><b>{item.owner}</b></div><div><span>Prioridad</span><b>{item.priority}</b></div><div><span>Estado actual</span><select aria-label="Cambiar estado" value={item.status} onChange={event => onStatus(event.target.value)}><option>Pendiente</option><option>En proceso</option><option>Completada</option></select></div></div><div className="detail-history"><strong>Observaciones y evidencia</strong><textarea rows="3" placeholder="Añade una observación para el historial..." value={observation} onChange={event => setObservation(event.target.value)}/><button className="button button-outline" onClick={() => onSaveObservation(observation)}>Guardar observación</button></div><div className="modal-actions"><button className="button button-outline" onClick={onEdit}>Editar actividad</button><button className="button button-primary" onClick={onClose}>Listo</button></div></div></div>;
}

function SettingRow({ title, description, checked, onChange }) {
  return <label className="settings-row"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/></label>;
}

function Metric({ label, value, change, note, icon, tone, data, down }) {
  return <div className="card metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon name={icon} size={18}/></div></div><div className="metric-value-row"><strong>{value}</strong><Sparkline data={data} tone={tone}/></div><div className="metric-foot"><b className={down ? 'change-down' : ''}>{down ? '↓' : '↑'} {change}</b><span>{note}</span></div></div>;
}
function Sparkline({ data, tone }) {
  const points = data.map((value, index) => `${index * 10},${30 - value * .3}`).join(' ');
  return <svg className={`sparkline ${tone}`} viewBox="0 0 110 32" preserveAspectRatio="none"><polyline points={points}/></svg>;
}
function Status({ status }) { return <span className={`status status-${status === 'En proceso' ? 'progress' : status === 'Completada' ? 'done' : 'pending'}`}><i/>{status}</span>; }

export default App;
