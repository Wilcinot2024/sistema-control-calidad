import React from 'react';
import PageHeader from '../components/PageHeader';

export default function SettingsPage({ preferences, period, periods, onPreferenceChange, onPeriodChange, onReset, onSave }) {
  return <>
    <PageHeader
      eyebrow="PREFERENCIAS DEL SISTEMA"
      title="Configuración"
      description="Ajusta los avisos simulados, la vista compacta y el período inicial del panel. Las preferencias se guardan en este navegador y te permiten adaptar la presentación de la demostración a tu forma de trabajar."
    />
    <div className="card settings-card">
      <h2>Notificaciones</h2>
      <p>Elige qué avisos simulados quieres ver.</p>
      <SettingRow title="Avisos dentro del sistema" description="Muestra notificaciones de cambios y nuevas asignaciones." checked={preferences.email} onChange={value => onPreferenceChange('email', value)}/>
      <SettingRow title="Resumen semanal" description="Activa un aviso demostrativo al revisar el panel semanal." checked={preferences.weeklySummary} onChange={value => onPreferenceChange('weeklySummary', value)}/>
      <h2 className="settings-subhead">Visualización</h2>
      <SettingRow title="Vista compacta" description="Reduce el espacio entre las filas de actividades." checked={preferences.compact} onChange={value => onPreferenceChange('compact', value)}/>
      <div className="settings-row">
        <span><strong>Periodo inicial del panel</strong><small>Selecciona el periodo que se muestra al abrir el panel.</small></span>
        <select value={period} onChange={event => onPeriodChange(event.target.value)}>{Object.keys(periods).map(value => <option key={value}>{value}</option>)}</select>
      </div>
      <div className="settings-actions">
        <button className="button button-outline" onClick={onReset}>Restablecer preferencias</button>
        <button className="button button-primary" onClick={onSave}>Guardar preferencias</button>
      </div>
    </div>
  </>;
}

function SettingRow({ title, description, checked, onChange }) {
  return <label className="settings-row">
    <span><strong>{title}</strong><small>{description}</small></span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}/>
  </label>;
}
