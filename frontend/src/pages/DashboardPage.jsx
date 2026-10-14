import React, { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { dashboardDate, inProgressByEntity } from './dashboardData';
import useAnimatedValues from '../hooks/useAnimatedValues';

// App conserva los datos y las acciones compartidas con las demás pantallas.
export default function DashboardPage({
  session,
  items,
  period,
  periods,
  onPeriodChange,
  recentActivities,
  audit,
  onNavigate,
}) {
  const [headerDate, setHeaderDate] = useState(() => dashboardDate());
  useEffect(() => {
    const refreshDate = () => setHeaderDate(dashboardDate());
    const timer = window.setInterval(refreshDate, 60_000);
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, []);
  const progressByEntity = inProgressByEntity(items);
  const currentPeriod = periods[period];
  const chartSlots = Math.max(0, ...Object.values(periods).map(value => value.bars.length));
  const periodCounts = {
    pending: Math.max(0, currentPeriod.pending + items.filter(item => item.status === 'Pendiente').length - 2),
    progress: Math.max(0, currentPeriod.progress + items.filter(item => item.status === 'En proceso').length - 2),
    completed: Math.max(0, currentPeriod.completed + items.filter(item => item.status === 'Completada').length - 1),
  };
  periodCounts.total = periodCounts.pending + periodCounts.progress + periodCounts.completed;
  periodCounts.completion = periodCounts.total ? Math.round(periodCounts.completed / periodCounts.total * 100) : 0;
  periodCounts.progressPercent = periodCounts.total ? Math.round(periodCounts.progress / periodCounts.total * 100) : 0;
  periodCounts.pendingPercent = Math.max(0, 100 - periodCounts.completion - periodCounts.progressPercent);
  const animatedCounts = useAnimatedValues(periodCounts);
  const displayCounts = Object.fromEntries(Object.entries(animatedCounts).map(([key, value]) => [key, Math.round(value)]));
  displayCounts.total = displayCounts.pending + displayCounts.progress + displayCounts.completed;
  displayCounts.pendingPercent = Math.max(0, 100 - displayCounts.completion - displayCounts.progressPercent);

  return <>
    <section className="welcome-row dashboard-welcome">
      <div className="eyebrow"><span className="live-dot"/> {headerDate} <span className="demo-label">DATOS DE DEMOSTRACIÓN</span></div>
      <h1>Buenos días, {session.name.split(' ')[0]} <span>👋</span></h1>
      <div className="dashboard-period-control">
        <label className="dashboard-period-label" htmlFor="dashboard-period">Periodo del panel</label>
        <select id="dashboard-period" className="dashboard-period-select" value={period} onChange={e => onPeriodChange(e.target.value)} title="Cambia el periodo de los indicadores y gráficos del panel. En proceso por entidad muestra el estado actual.">
          {Object.keys(periods).map(value => <option key={value}>{value}</option>)}
        </select>
      </div>
      <p>Consulta el resumen de Control de Calidad: actividades pendientes, trabajo en proceso y registros completados. Revisa los indicadores, las actividades recientes y los últimos movimientos del equipo; gestiona los registros desde Actividades e Inspecciones.</p>
    </section>
    <section className="metric-grid" aria-label="Resumen de actividades">
      <Metric label="Actividades totales" value={displayCounts.total} change="12%" note={`en ${period.toLowerCase()}`} icon="clipboard" tone="blue" data={[24,31,26,42,36,53,48,67,58,74,64,85]}/>
      <Metric label="Pendientes" value={displayCounts.pending} change="3 menos" note="vs. período anterior" icon="calendar" tone="amber" data={[70,65,76,61,68,47,55,42,51,37,41,30]} down/>
      <div className="card metric-card progress-entities" aria-label="En proceso por entidad">
        <div className="metric-top"><span>En proceso por entidad</span><div className="metric-icon violet" title="SDI, productos e inspecciones actualmente en proceso; cada entidad se cuenta por separado."><Icon name="history" size={18} title="Registros en proceso por entidad"/></div></div>
        <dl className="entity-counts">
          <div><dt>SDI</dt><dd>{progressByEntity.SDI}</dd></div>
          <div><dt><span>Productos</span><abbr title="Productos">Prod.</abbr></dt><dd>{progressByEntity.Producto}</dd></div>
          <div><dt><span>Inspecciones</span><abbr title="Inspecciones">Insp.</abbr></dt><dd>{progressByEntity.Inspección}</dd></div>
        </dl>
        <div className="metric-foot"><span>Estado actual de los registros locales</span></div>
      </div>
      <Metric label="Completadas" value={displayCounts.completed} change={`${displayCounts.completion}%`} note="tasa de cumplimiento" icon="check" tone="green" data={[20,29,24,37,35,48,44,57,53,70,66,82]}/>
    </section>
    <section className="middle-grid">
      <div className="card performance-card"><div className="card-heading"><div className="performance-heading-copy" key={period}><h2>{currentPeriod.title}</h2><p>{currentPeriod.subtitle}</p></div></div><div className="chart-wrap"><div className="chart-y"><span>30</span><span>20</span><span>10</span><span>0</span></div><div className="chart"><div className="gridline"/><div className="gridline"/><div className="gridline"/><div className="gridline"/><div className="bars" style={{gridTemplateColumns: Array.from({length: chartSlots}, (_, index) => index < currentPeriod.bars.length ? '1fr' : '0fr').join(' ')}}>{Array.from({length: chartSlots}, (_, index) => {
        const bar = currentPeriod.bars[index];
        const [day, done, pending] = bar || ['', 0, 0];
        return <div className={`bar-group${bar ? '' : ' bar-group-hidden'}`} key={index} aria-hidden={!bar}><div className="bar-pair"><i style={{height:`${done}%`}}/><i style={{height:`${pending}%`}}/></div><span className="bar-label" key={day}>{day}</span></div>;
      })}</div></div></div><div className="chart-legend"><span><i className="legend-blue"/> Completadas</span><span><i className="legend-pale"/> Pendientes</span><small><b>↑ 8.2%</b> respecto al período anterior</small></div></div>
      <div className="card completion-card"><div className="card-heading"><div><h2>Estado de actividades</h2><p className="performance-heading-copy" key={period}>{period}</p></div><button className="icon-button" aria-label="Ver actividades" title="Abrir Actividades para consultar los registros" onClick={() => onNavigate('Actividades')}><Icon name="more" title="Ver actividades"/></button></div><div className="donut-area"><div className="donut" style={{background:`conic-gradient(#267ab5 0 ${animatedCounts.completion}%,#9080d3 ${animatedCounts.completion}% ${animatedCounts.completion + animatedCounts.progressPercent}%,var(--chart-pending, #e5eaf0) ${animatedCounts.completion + animatedCounts.progressPercent}% 100%)`}}><div><strong>{displayCounts.total}</strong><span>Total</span></div></div><div className="donut-center-label"><span><i className="dot-blue"/>Completadas <b>{displayCounts.completion}%</b></span><span><i className="dot-violet"/>En proceso <b>{displayCounts.progressPercent}%</b></span><span><i className="dot-gray"/>Pendientes <b>{displayCounts.pendingPercent}%</b></span></div></div><div className="completion-foot"><span className="tiny-check">✓</span><span><b>Buen trabajo del equipo</b><small>El cumplimiento subió 8.2% en este período.</small></span></div></div>
    </section>
    <section className="bottom-grid">
      <div className="card activity-card"><div className="card-heading activity-heading"><div><h2>Actividades recientes</h2><p>Organiza y revisa el trabajo del equipo</p></div><button className="text-button" onClick={() => onNavigate('Actividades')}>Ver todas <Icon name="arrow" size={16}/></button></div>{recentActivities}</div>
      <TraceCard audit={audit} onOpen={() => onNavigate('Trazabilidad')}/>
    </section>
  </>;
}

function TraceCard({ audit, onOpen }) {
  return <div className="card trace-card"><div className="card-heading"><div><h2>Última trazabilidad</h2><p>Movimientos recientes</p></div></div><div className="timeline">{audit.slice(0, 3).map(entry => <div className="timeline-item" key={entry.id}><div className={`avatar avatar-small ${entry.color}`}>{entry.initials}</div><div className="timeline-copy"><p><b>{entry.actor}</b> {entry.action} <b>{entry.itemId}</b></p><span>{entry.time}</span></div><span className="timeline-icon">{entry.icon}</span></div>)}</div><button className="trace-link" onClick={onOpen}>Ver historial completo <Icon name="arrow" size={15}/></button></div>;
}

function Metric({ label, value, change, note, icon, tone, data, down }) {
  return <div className="card metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`} title={`${label}: indicador de demostración del período seleccionado.`}><Icon name={icon} size={18} title={label}/></div></div><div className="metric-value-row"><strong>{value}</strong><Sparkline data={data} tone={tone}/></div><div className="metric-foot"><b className={down ? 'change-down' : ''}>{down ? '↓' : '↑'} {change}</b><span>{note}</span></div></div>;
}
function Sparkline({ data, tone }) {
  const points = data.map((value, index) => `${index * 10},${30 - value * .3}`).join(' ');
  return <svg className={`sparkline ${tone}`} viewBox="0 0 110 32" preserveAspectRatio="none" aria-hidden="true"><title>Tendencia de demostración del período seleccionado</title><polyline points={points}/></svg>;
}
