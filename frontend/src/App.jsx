import OperationalApp from './pages/OperationalApp';
import ThemeToggle from './components/ThemeToggle';
import RecordActionDialog from './components/RecordActionDialog';
import { recordView, recordActions, applyRecordAction } from './pages/recordLifecycle';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import logoAncor from './assets/Logotipo ANCOR TECMIN.png';
import DashboardPage from './pages/DashboardPage';
import ActivitiesPage from './pages/ActivitiesPage';
import InspectionsPage from './pages/InspectionsPage';
import TraceabilityPage from './pages/TraceabilityPage';
import TeamPage from './pages/TeamPage';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import DemoLoginPage from './pages/DemoLoginPage';
import ActivityFilters from './components/ActivityFilters';
import ActivityTable from './components/ActivityTable';
import Icon from './components/Icon';
import useAreaCatalog from './hooks/useAreaCatalog';
import { matchesInspectorArea } from './pages/dashboardData';
import { activityCsvHeaders, activityCsvRows, downloadCsv } from './pages/csvExport';
import { todayInSantiago } from './components/sdiFields';
import { SDIModal, ProductoModal, InspeccionModal, demoInspectors } from './components/QualityForms';

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


function DemoApp({ controls }) {
  const [items, setItems] = useState(() => readJson('ancor.demo.activities.v1', seedItems));
  const [members, setMembers] = useState(() => readJson('ancor.demo.team.v1', team));
  const [audit, setAudit] = useState(() => readJson('ancor.demo.audit.v1', seedAudit));
  const [session, setSession] = useState(() => readJson('ancor.demo.session.v1', { name: 'Guilbaud Wilcinot', email: 'gu.wilcinot@duocuc.cl', role: 'Administrador' }));
  const areaCatalog = useAreaCatalog(session?.accessToken);
  const [activeNav, setActiveNav] = useState('Panel de control');
  const [period, setPeriod] = useState(() => readJson('ancor.demo.period.v1', 'Esta semana'));
  const [formType, setFormType] = useState('SDI');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [areaFilter, setAreaFilter] = useState('');
  const [showAreaFilter, setShowAreaFilter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState(null);
  const [recordAction, setRecordAction] = useState(null);
  const [recordListView, setRecordListView] = useState('activas');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [preferences, setPreferences] = useState(() => readJson('ancor.demo.preferences.v1', { email: true, weeklySummary: false, compact: false }));
  const [collapsed, setCollapsed] = useState(false);
  const searchRef = useRef(null);
  const manager = ['Administrador', 'Jefe de Calidad', 'Supervisor'].includes(session?.role);
  const activeItems = items.filter(item => recordView(item, items) === 'activas');
  const sdis = activeItems.filter(item => item.formType === 'SDI');
  const productos = activeItems.filter(item => item.formType === 'Producto');

  useEffect(() => {
    if (areaFilter && !areaCatalog.areas.some(area => String(area.id) === areaFilter)) setAreaFilter('');
  }, [areaCatalog.areas, areaFilter]);
  const visibleItems = useMemo(() => items.filter(item => {
    if (activeNav === 'Panel de control' ? recordView(item, items) !== 'activas' : recordListView !== 'todas' && recordView(item, items) !== recordListView) return false;
    const matchesQuery = `${item.id} ${item.title} ${item.owner} ${item.area}`.toLowerCase().includes(query.toLowerCase());
    const matchesState = filter === 'Todas' || item.status === filter;
    const matchesArea = activeNav === 'Panel de control' || matchesInspectorArea(item, areaFilter, items);
    const matchesKind = activeNav !== 'Inspecciones' || item.kind === 'Inspección';
    return matchesQuery && matchesState && matchesArea && matchesKind;
  }), [items, query, filter, areaFilter, activeNav, recordListView]);

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
  // Compatibilidad con la edición de los registros de demostración anteriores.
  const requestRecordAction = action => {
    const descriptions = {
      annul: ['Anular SDI', 'La SDI quedará anulada por error o duplicidad. Los productos y el historial se conservarán. Esta acción no se revierte.'],
      withdraw: ['Retirar producto', 'Se retirará el producto de esta SDI pendiente y quedará registrado en el historial de demostración.'],
      archive: ['Archivar registro', 'El registro saldrá de la vista habitual. Conserva su estado e información; si es una SDI, sus productos e inspecciones se ocultarán con ella.'],
      restore: ['Restaurar registro', 'Volverá a la vista correspondiente a su estado. Los registros anulados seguirán anulados.'],
    };
    setRecordAction({ action, title: descriptions[action][0], description: descriptions[action][1], needsReason: action === 'annul' });
  };
  const confirmRecordAction = reason => {
    try {
      const next = applyRecordAction(items, selected, recordAction.action, reason, manager);
      const updated = next.find(entry => entry.id === selected.id);
      setItems(next);
      addAudit(`${recordAction.title}${reason ? `: ${reason} ·` : ' ·'}`, updated);
      setSelected(null); setRecordAction(null);
      notify('Acción registrada en la demostración.');
    } catch (error) { notify(error.message); }
  };

  const submitLegacyItem = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const owner = String(data.get('owner')).trim();
    const initials = owner.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
    const formItem = { title: String(data.get('title')).trim(), area: String(data.get('area')).trim(), owner, initials, priority: data.get('priority'), kind: data.get('kind'), observation: String(data.get('observation') || '').trim() };
    const updated = { ...editing, ...formItem };
    setItems(current => current.map(item => item.id === editing.id ? updated : item));
    addAudit('editó', updated); setSelected(updated); notify('Cambios guardados.');
    setEditing(null); setShowModal(false);
  };
  const submitQualityForm = (type, fields) => {
    if (type === 'SDI' && items.filter(item => item.formType === 'SDI').some(item => item.localId !== editing?.localId && item.data.prefijo_bod === fields.prefijo_bod && item.data.activacion_proyecto === fields.activacion_proyecto && item.data.numero_sdi === fields.numero_sdi)) {
      notify('Ya existe una SDI con ese código en este navegador.'); return;
    }
    if (type === 'Producto' && productos.some(item => item.localId !== editing?.localId && item.data.sdi === fields.sdi && item.data.orden === fields.orden)) {
      notify('Ya existe un producto con ese orden en la SDI.'); return;
    }
    const localId = editing?.localId ?? Math.max(0, ...items.map(item => item.localId ?? 0)) + 1;
    const data = { ...editing?.data, ...fields };
    const inspector = demoInspectors.find(person => person.id === data.inspector);
    const producto = productos.find(item => item.localId === data.item);
    const sdi = sdis.find(item => item.localId === (data.sdi ?? producto?.data.sdi));
    let display;
    if (type === 'SDI') {
      data.codigo_sdi = `SDI-${data.prefijo_bod ? 'BOD-' : ''}${data.activacion_proyecto}-${data.numero_sdi}`;
      display = { id: data.codigo_sdi, title: data.proyecto, area: data.departamento_solicitante, owner: inspector.nombre, priority: data.prioridad[0].toUpperCase() + data.prioridad.slice(1) };
    } else if (type === 'Producto') {
      display = { id: `PROD-${localId}`, title: data.articulo, area: sdi.data.departamento_solicitante, owner: '—', priority: '—' };
    } else {
      display = { id: `INS-${localId}`, title: `Inspección · ${producto.data.articulo}`, area: sdi.data.departamento_solicitante, owner: inspector.nombre, priority: '—' };
    }
    // Los campos del formulario se conservan con los nombres de la API.
    // La vista actual sigue usando estos datos de presentación hasta su integración.
    const record = {
      ...editing, ...display, localId, formType: type, data, kind: type,
      initials: display.owner === '—' ? '—' : display.owner.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase(),
      status: editing?.status ?? (type === 'Inspección' ? 'En proceso' : 'Pendiente'),
      date: type === 'SDI' ? data.fecha_emision : (editing?.date ?? new Date().toLocaleDateString('es-CL')),
      observation: data.observaciones,
    };
    setItems(current => editing ? current.map(item => item.id === editing.id ? record : item) : [record, ...current]);
    setFilter('Todas'); setAreaFilter('');
    addAudit(editing ? 'editó' : 'creó', record);
    if (editing) setSelected(record);
    setEditing(null); setShowModal(false);
    notify(`${type}: ${editing ? 'cambios guardados' : 'registro guardado'} en este navegador.`);
  };
  const updateStatus = (item, status) => {
    if (recordView(item, items) !== 'activas') { notify('Restaura los archivados antes de editar; los anulados se conservan como historial.'); return; }
    const updated = { ...item, status };
    setItems(current => current.map(entry => entry.id === item.id ? updated : entry));
    if (status === 'Pendiente') setNotificationsRead(false);
    setSelected(updated); addAudit(`cambió el estado a “${status}” de`, updated); notify(`Estado actualizado: ${status.toLowerCase()}.`);
  };
  const exportCsv = () => {
    if (!visibleItems.length) { notify('No hay registros con estos filtros para exportar.'); return; }
    const section = activeNav === 'Inspecciones' ? 'inspecciones' : 'actividades';
    downloadCsv(activityCsvHeaders, activityCsvRows(visibleItems, items), `${section}-calidad-${todayInSantiago()}.csv`);
    notify(`CSV exportado: ${visibleItems.length} registros, con columnas separadas para Excel.`);
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
    { label: 'GENERAL', links: [{ name: 'Panel de control', icon: 'grid' }, { name: 'Actividades', icon: 'clipboard', count: String(activeItems.filter(i => i.status !== 'Completada').length) }, { name: 'Inspecciones', icon: 'check' }, { name: 'Trazabilidad', icon: 'history' }] },
    { label: 'GESTIÓN', links: [{ name: 'Equipo', icon: 'users' }, { name: 'Configuración', icon: 'settings' }] },
  ];

  if (!session) return <>{controls}<DemoLoginPage onLogin={doLogin}/></>;

  const openQualityForm = (type) => { setEditing(null); setSelected(null); setShowModal(true); setFormType(type); };
  const filterProps = {
    filter, setFilter, showAreaFilter, setShowAreaFilter,
    areaFilter, setAreaFilter, areaCatalog,
  };
  const recordsPageProps = {
    items: visibleItems,
    allItems: items,
    filters: {
      ...filterProps,
      recordListView,
      onRecordListView: value => { setRecordListView(value); setFilter('Todas'); },
    },
    onSelect: setSelected,
    onExport: exportCsv,
    onCreate: openQualityForm,
  };
  // App coordina las páginas; cada una presenta sus propios controles y contenido.
  const pages = {
    'Panel de control': <DashboardPage
      session={session}
      items={activeItems}
      period={period}
      periods={periods}
      onPeriodChange={changePeriod}
      recentActivities={<>
        <ActivityFilters {...filterProps} showAreaControl={false}/>
        <ActivityTable items={visibleItems} allItems={items} onSelect={setSelected} limit={5}/>
      </>}
      audit={audit}
      onNavigate={setActiveNav}
    />,
    Actividades: <ActivitiesPage {...recordsPageProps}/>,
    Inspecciones: <InspectionsPage {...recordsPageProps}/>,
    Trazabilidad: <TraceabilityPage
      audit={audit}
      onClear={() => { setAudit([]); notify('Se limpió el historial de demostración.'); }}
      onOpenRecord={id => { const item = items.find(entry => entry.id === id); if (item) setSelected(item); }}
    />,
    Equipo: <TeamPage members={members} onInvite={() => setShowInviteModal(true)}/>,
    Configuración: <SettingsPage
      preferences={preferences}
      period={period}
      periods={periods}
      onPreferenceChange={(name, value) => setPreferences(current => ({ ...current, [name]: value }))}
      onPeriodChange={changePeriod}
      onReset={() => {
        setPreferences({ email: true, weeklySummary: false, compact: false });
        setPeriod('Esta semana');
        notify('Preferencias restablecidas.');
      }}
      onSave={() => notify('Preferencias guardadas en este navegador.')}
    />,
    Ayuda: <HelpPage/>,
  };

  return <div className="app-shell">
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="brand"><img src={logoAncor} alt="Ancor Tecmin" className="brand-logo"/><button className="collapse" aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Mostrar el menú de secciones' : 'Contraer el menú de secciones'} onClick={() => setCollapsed(value => !value)}>{collapsed ? '›' : '‹'}</button></div>
      <div className="workspace"><div className="workspace-icon">AC</div><div className="workspace-copy"><span>Espacio de trabajo</span><strong>Control de Calidad</strong></div><span className="chevron">⌄</span></div>
      <nav>{nav.map(group => <div className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.links.map(link => <button key={link.name} title={`Abrir ${link.name}`} aria-label={`Abrir ${link.name}`} onClick={() => { setActiveNav(link.name); setProfileOpen(false); }} className={`nav-link ${activeNav === link.name ? 'active' : ''}`}><Icon name={link.icon}/><span>{link.name}</span>{link.count && <small className="nav-count">{link.count}</small>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon" title="Guía de ayuda">✦</div><strong>¿Necesitas ayuda?</strong><span>Revisa la guía rápida para comenzar.</span><button onClick={() => setActiveNav('Ayuda')}>Ver guía <Icon name="arrow" size={15}/></button></div><div className="profile"><div className="avatar avatar-navy">{session.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div><div className="profile-copy"><strong>{session.name}</strong><span>{session.role}</span></div><button className="icon-button" aria-label="Opciones de perfil" title="Ver perfil y cerrar sesión" onClick={() => setProfileOpen(!profileOpen)}><Icon name="more"/></button>{profileOpen && <div className="popover profile-popover"><strong>{session.name}</strong><span>{session.email}</span><button onClick={() => { setProfileOpen(false); notify('Estás usando el perfil de demostración.'); }}>Mi perfil</button><button className="logout-action" onClick={() => { setSession(null); setProfileOpen(false); }}><Icon name="logout" size={16}/> Cerrar sesión</button></div>}</div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Control de Calidad</span><b>/</b><strong>{activeNav}</strong></div><div className="top-actions">{controls}<div className="search-box" title="Buscar por código, actividad, responsable o departamento. Atajo: Ctrl + K."><Icon name="search" size={17}/><input ref={searchRef} aria-label="Buscar actividades" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar actividades..."/><kbd>⌘ K</kbd></div><div className="notification-wrap"><button className="icon-button notification" aria-label="Notificaciones" title="Ver avisos de registros pendientes de la demostración" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}><Icon name="bell"/>{preferences.email && !notificationsRead && <i/>}</button>{notificationsOpen && <div className="popover notification-popover"><div className="popover-heading"><strong>Notificaciones</strong><button onClick={() => setNotificationsRead(true)}>Marcar leídas</button></div>{activeItems.filter(item => item.status === 'Pendiente').slice(0, 3).map(item => <button className="notification-item" key={item.id} onClick={() => { setSelected(item); setNotificationsOpen(false); }}><span className="notification-dot"/><span><b>{item.kind} pendiente</b><small>{item.title}</small></span></button>)}{!activeItems.some(item => item.status === 'Pendiente') && <p className="empty-notifications">No tienes pendientes de revisión.</p>}</div>}</div><button className="avatar avatar-navy top-avatar profile-trigger" aria-label="Abrir perfil" title="Abrir el perfil de la sesión" onClick={() => setProfileOpen(!profileOpen)}>{session.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</button></div></header>
      {profileOpen && <div className="popover top-profile-menu"><strong>{session.name}</strong><span>{session.email}</span><button onClick={() => notify('Estás usando el perfil de demostración.')}>Mi perfil</button><button className="logout-action" onClick={() => { setSession(null); setProfileOpen(false); }}><Icon name="logout" size={16}/> Cerrar sesión</button></div>}
      <div className={`page-content ${preferences.compact ? 'compact-content' : ''}`}>
        {pages[activeNav] ?? pages.Configuración}
        <footer className="page-footer"><span>© 2026 Ancor Tecmin · Control de Calidad</span><span><i/> Datos locales de demostración <b>·</b> Se guardan en este navegador</span></footer>
      </div>
    </main>
    {showModal && formType === 'SDI' && <SDIModal initial={editing?.data} inspectors={demoInspectors} onClose={() => { setShowModal(false); setEditing(null); }} onSubmit={data => submitQualityForm('SDI', data)}/>}
    {showModal && formType === 'Producto' && <ProductoModal initial={editing?.data} sdis={sdis} productos={productos} onClose={() => { setShowModal(false); setEditing(null); }} onSubmit={data => submitQualityForm('Producto', data)}/>}
    {showModal && formType === 'Inspección' && <InspeccionModal initial={editing?.data} productos={productos} sdis={sdis} inspectors={demoInspectors} onClose={() => { setShowModal(false); setEditing(null); }} onSubmit={data => submitQualityForm('Inspección', data)}/>}
    {showModal && formType === 'Legacy' && <LegacyItemModal initial={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSubmit={submitLegacyItem}/>}
    {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} onSubmit={inviteMember}/>}
    {recordAction && <RecordActionDialog {...recordAction} onClose={() => setRecordAction(null)} onConfirm={confirmRecordAction}/>}
    {selected && !recordAction && <DetailModal item={selected} readOnly={recordView(selected, items) !== 'activas'} actions={recordActions(selected, items, manager)} onAction={requestRecordAction} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setFormType(selected.formType ?? 'Legacy'); setSelected(null); setShowModal(true); }} onStatus={status => updateStatus(selected, status)} onSaveObservation={observation => { const updated = { ...selected, observation, ...(selected.data ? { data: { ...selected.data, observaciones: observation } } : {}) }; setItems(current => current.map(entry => entry.id === selected.id ? updated : entry)); setSelected(updated); addAudit('actualizó observaciones de', updated); notify('Observación guardada.'); }}/>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

function InviteModal({ onClose, onSubmit }) {
  return <div className="modal-backdrop" onClick={onClose}><form className="modal" onSubmit={onSubmit} onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="modal-icon"><Icon name="users"/></div><h2>Invitar integrante</h2><p>Registra una invitación de muestra para el equipo.</p></div><button type="button" className="icon-button" aria-label="Cerrar" title="Cerrar esta ventana" onClick={onClose}><Icon name="close"/></button></div><label>Nombre completo<input name="name" placeholder="Nombre y apellido" required autoFocus/></label><label>Correo electrónico<input name="email" type="email" placeholder="nombre@empresa.cl" required/></label><label>Rol<select name="role"><option>Inspector de calidad</option><option>Analista funcional y líder de integración</option><option>Desarrollador Backend y Base de Datos</option><option>Desarrollador Frontend, UX y QA</option></select></label><div className="demo-notice">No se enviará un correo real. La invitación se agrega a la lista de este navegador.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">Registrar invitación</button></div></form></div>;
}

function LegacyItemModal({ initial, onClose, onSubmit }) {
  return <div className="modal-backdrop" onClick={onClose}><form className="modal" onSubmit={onSubmit} onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="modal-icon"><Icon name={initial ? 'clipboard' : 'plus'}/></div><h2>{initial ? 'Editar registro' : 'Nueva actividad'}</h2><p>{initial ? `Actualiza los datos de ${initial.id}.` : 'Registra una actividad o inspección para el equipo.'}</p></div><button type="button" className="icon-button" aria-label="Cerrar" title="Cerrar esta ventana" onClick={onClose}><Icon name="close"/></button></div><label>Nombre de la actividad<input name="title" placeholder="Ej. Inspección de equipos..." required autoFocus defaultValue={initial?.title}/></label><div className="form-row"><label>Tipo<select name="kind" defaultValue={initial.kind}><option>Actividad</option><option>Inspección</option></select></label><label>Prioridad<select name="priority" defaultValue={initial?.priority || 'Media'}><option>Media</option><option>Alta</option><option>Baja</option></select></label></div><div className="form-row"><label>Área<input name="area" placeholder="Ej. Planta Norte" required defaultValue={initial?.area}/></label><label>Responsable<input name="owner" placeholder="Nombre y apellido" required defaultValue={initial?.owner}/></label></div><label>Observaciones<textarea name="observation" rows="3" placeholder="Notas o evidencia relevante..." defaultValue={initial?.observation}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit">{initial ? 'Guardar cambios' : <><Icon name="plus" size={17}/> Crear actividad</>}</button></div></form></div>;
}

function DetailModal({ item, readOnly, actions, onAction, onClose, onEdit, onStatus, onSaveObservation }) {
  const [observation, setObservation] = useState(item.observation || '');
  return <div className="modal-backdrop" onClick={onClose}><div className="modal detail-modal" onClick={event => event.stopPropagation()}>
    <div className="modal-head"><div><span className="detail-id">{item.id} · {item.kind}</span><h2>{item.title}</h2><p>{item.area} · {item.date}</p></div><button className="icon-button" aria-label="Cerrar" title="Cerrar esta ventana" onClick={onClose}><Icon name="close"/></button></div>
    <div className="detail-grid"><div><span>Responsable</span><b>{item.owner}</b></div><div><span>Prioridad</span><b>{item.priority}</b></div><div><span>Estado actual</span>{readOnly ? <b>{item.withdrawn ? 'Retirado' : item.status}{item.archived ? ' · Archivado' : ''}</b> : <select aria-label="Cambiar estado" value={item.status} onChange={event => onStatus(event.target.value)}><option>Pendiente</option><option>En proceso</option><option>Completada</option></select>}</div></div>
    {item.annulReason && <p>Motivo de anulación: {item.annulReason}</p>}
    <div className="detail-history"><strong>Observaciones y evidencia</strong><textarea readOnly={readOnly} rows="3" placeholder="Añade una observación para el historial..." value={observation} onChange={event => setObservation(event.target.value)}/>{!readOnly && <button className="button button-outline" onClick={() => onSaveObservation(observation)}>Guardar observación</button>}</div>
    <div className="modal-actions detail-actions">
      <div className="record-actions">{Object.entries({ annul: 'Anular SDI', withdraw: 'Retirar producto', archive: 'Archivar registro', restore: 'Restaurar registro' }).map(([action, title]) => actions[action] && <button className="button button-outline" key={action} onClick={() => onAction(action)}>{title}</button>)}</div>
      <div className="detail-primary-actions">{!readOnly && <button className="button button-outline" onClick={onEdit}>{item.formType ? 'Editar ' + item.kind.toLowerCase() : 'Editar actividad'}</button>}<button className="button button-primary" onClick={onClose}>Listo</button></div>
    </div>
  </div></div>;
}

function App() {
  const [demo, setDemo] = useState(() => localStorage.getItem('ancor.mode') !== 'operational');
  const changeMode = value => { localStorage.setItem('ancor.mode', value ? 'demo' : 'operational'); setDemo(value); };
  const controls = <div className="mode-controls"><button type="button" title={demo ? "Entrar al sistema conectado con un usuario y contraseña del backend" : "Volver a los datos locales de demostración"} onClick={() => changeMode(!demo)}>{demo ? 'Sistema conectado' : 'Ver demostración'}</button><ThemeToggle/></div>;
  return demo ? <DemoApp controls={controls}/> : <>{controls}<OperationalApp/></>;
}
export default App;
