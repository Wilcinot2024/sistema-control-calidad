import React, { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('ancor.theme') === 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    localStorage.setItem('ancor.theme', dark ? 'dark' : 'light');
  }, [dark]);
  return <button className="theme-toggle" type="button" aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'} title={dark ? 'Modo claro' : 'Modo oscuro'} aria-pressed={dark} onClick={() => setDark(value => !value)}>{dark ? '☀' : '☾'}</button>;
}
