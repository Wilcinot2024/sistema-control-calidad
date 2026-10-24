import React from 'react';
import PageHeader from '../components/PageHeader';

export default function TeamPage({ members, onInvite }) {
  return <>
    <PageHeader
      eyebrow="PERSONAS Y RESPONSABILIDADES"
      title="Equipo"
      description="Consulta los integrantes del equipo y sus funciones dentro de Control de Calidad. Puedes revisar los perfiles y registrar invitaciones de demostración para probar la organización del equipo; estas invitaciones no envían correos reales."
      actions={<button className="button button-primary" onClick={onInvite}>+ Invitar integrante</button>}
    />
    <div className="team-grid">{members.map(person => <div className="card team-card" key={person.email || person.name}>
      <div className={`avatar ${person.color}`}>{person.initials}</div>
      <div><strong>{person.name}</strong><span>{person.role}</span>{person.email && <small>{person.email}</small>}</div>
      <span className={`team-active ${person.status ? 'team-invited' : ''}`}><i/> {person.status || 'Activo'}</span>
    </div>)}</div>
    <div className="demo-notice">Los perfiles son datos ficticios de demostración; los nombres reales del equipo están pendientes de confirmación en el anteproyecto.</div>
  </>;
}
