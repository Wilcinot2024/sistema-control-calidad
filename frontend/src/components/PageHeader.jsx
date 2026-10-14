import React from 'react';

export default function PageHeader({ eyebrow, title, description, actions }) {
  return <section className="welcome-row">
    <div>
      <div className="eyebrow"><span className="live-dot"/> {eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions}
  </section>;
}
