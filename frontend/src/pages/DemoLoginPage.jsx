import React from 'react';
import Icon from '../components/Icon';

export default function DemoLoginPage({ onLogin }) {
  return <main className="login-page"><div className="login-card"><div className="login-brand"><div className="brand-mark"><span/><span/><span/><span/></div><div><strong>ancor<span>.</span></strong><small>TECMin · CALIDAD</small></div></div><div className="login-kicker">CONTROL DE CALIDAD</div><h1>Bienvenido/a</h1><p>Inicia una sesión de demostración para continuar.</p><form onSubmit={onLogin}><label>Nombre<input name="name" placeholder="Tu nombre (opcional)"/></label><label>Correo electrónico<input name="email" type="email" placeholder="nombre@empresa.cl" required defaultValue="gu.wilcinot@duocuc.cl"/></label><label>Contraseña de demostración<input name="password" type="password" placeholder="Escribe cualquier contraseña" required/></label><button className="button button-primary login-submit" type="submit">Iniciar sesión <Icon name="arrow" size={16}/></button></form><small className="login-note">Modo demo: se acepta cualquier contraseña. No se envían ni guardan credenciales.</small></div></main>;
}
