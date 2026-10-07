'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tier } from './types';

export const TIER: Record<Tier, { icon: string; label: string; cls: string; hint: string }> = {
  live: { icon: '🟢', label: 'Realtime · GPS', cls: 'live', hint: 'Previsione GTT con posizione GPS del mezzo aggiornata' },
  prevision: { icon: '🔵', label: 'Realtime · previsione', cls: 'prevision', hint: 'Previsione di arrivo fornita da GTT, senza GPS recente' },
  scheduled: { icon: '⚪', label: 'Programmato', cls: 'scheduled', hint: 'Orario teorico da tabella, non è un arrivo realtime' },
  stale: { icon: '🟠', label: 'Datato', cls: 'stale', hint: 'Dato realtime esistente ma non aggiornato di recente' },
  unavailable: { icon: '🔴', label: 'Non disponibile', cls: 'unavailable', hint: 'Nessun dato utilizzabile' },
};

export const CONF_LABEL = { high: 'Alta affidabilità', medium: 'Affidabilità media', low: 'Bassa affidabilità' } as const;

/** Pallino di stato: per i dati realtime dipende dall'affidabilità calcolata, mai automaticamente verde. */
export function dot(a: { tier: Tier; confidence: 'high' | 'medium' | 'low' | null }, effective?: 'high' | 'medium' | 'low' | null): { icon: string; cls: string } {
  if (a.tier === 'scheduled') return { icon: '⚪', cls: 'scheduled' };
  if (a.tier === 'stale') return { icon: '🟠', cls: 'stale' };
  if (a.tier === 'unavailable') return { icon: '🔴', cls: 'unavailable' };
  const c = effective ?? a.confidence ?? 'low';
  return c === 'high' ? { icon: '🟢', cls: 'live' } : c === 'medium' ? { icon: '🟡', cls: 'prevision' } : { icon: '🔴', cls: 'unavailable' };
}

/** Scarica un endpoint JSON a intervalli; si ferma quando la scheda è in background. */
export function usePoll<T>(url: string | null, intervalMs = 20000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const skew = useRef(0);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    setLoading(true);
    try {
      const r = await fetch(u, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Errore ' + r.status);
      if (j.generatedAt) skew.current = j.generatedAt - Date.now();
      setData(j as T);
      setError(null);
      setLoadedAt(Date.now());
    } catch (e) {
      setError(navigator.onLine ? (e as Error).message : 'Sei offline: i dati realtime richiedono la connessione.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, intervalMs);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [url, intervalMs, load]);

  return { data, error, loadedAt, loading, reload: load, skew };
}

/** Orologio che avanza ogni `ms`, corretto con lo scarto rispetto all'orologio del server. */
export function useNow(skewRef: { current: number }, ms = 5000) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
  return Date.now() + skewRef.current;
}

export function ago(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return 'n/d';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s} secondi fa`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} minuti fa`;
  return `${Math.round(m / 60)} ore fa`;
}

export function clock(ts: number): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ts));
}

/** Lista salvata solo sul dispositivo (localStorage). `initial` vale solo se non c'è ancora nulla di salvato. */
export function useLocalList<T>(key: string, initial: T[]) {
  const [list, setList] = useState<T[]>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setList(JSON.parse(raw));
    } catch { /* storage non disponibile: si usa il valore iniziale */ }
    setReady(true);
  }, [key]);
  const save = useCallback((next: T[]) => {
    setList(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignorato */ }
  }, [key]);
  return { list, save, ready };
}
