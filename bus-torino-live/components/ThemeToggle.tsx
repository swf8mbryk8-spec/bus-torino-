'use client';
import { useEffect, useState } from 'react';

type Mode = 'auto' | 'light' | 'dark';
const NEXT: Record<Mode, Mode> = { auto: 'light', light: 'dark', dark: 'auto' };
const LABEL: Record<Mode, string> = { auto: '🌓 Auto', light: '🌞 Chiaro', dark: '🌙 Scuro' };

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('auto');
  useEffect(() => {
    try { setMode((localStorage.getItem('btl:theme') as Mode) || 'auto'); } catch { /* ignorato */ }
  }, []);
  function apply(m: Mode) {
    setMode(m);
    try { localStorage.setItem('btl:theme', m); } catch { /* ignorato */ }
    if (m === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', m);
  }
  return <button className="btn ghost" type="button" onClick={() => apply(NEXT[mode])} aria-label="Cambia tema">{LABEL[mode]}</button>;
}
