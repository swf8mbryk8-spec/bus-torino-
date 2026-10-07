// Storico dei passaggi, salvato SOLO sul dispositivo (localStorage). Nessun invio a server.
import type { Arrival } from './types';
import { dayParts, type Obs } from './estimate';

const KEY = 'btl:history:v1';
const NAMES = 'btl:history:names';
const ENABLED = 'btl:history:enabled';
export const MAX_OBS = 6000;
export const MAX_AGE_DAYS = 120;
/** Un passaggio è registrato solo se l'ultima previsione realtime è stata vista al massimo così prima dell'orario previsto. */
export const MAX_LEAD_MS = 4 * 60_000;
const GRACE_MS = 90_000;

const ls = (): Storage | null => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };
let cache: Obs[] | null = null;

export function getHistory(): Obs[] {
  if (cache) return cache;
  try { cache = JSON.parse(ls()?.getItem(KEY) || '[]') as Obs[]; } catch { cache = []; }
  return cache;
}
function persist(list: Obs[]) {
  cache = list;
  try { ls()?.setItem(KEY, JSON.stringify(list)); } catch { /* spazio esaurito o storage non disponibile */ }
  try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('btl:history')); } catch { /* ignorato */ }
}
export function historyEnabled(): boolean { return ls()?.getItem(ENABLED) !== '0'; }
export function setHistoryEnabled(on: boolean) { try { ls()?.setItem(ENABLED, on ? '1' : '0'); } catch { /* ignorato */ } }

export function addObservation(o: Obs, now = Date.now()): boolean {
  const list = getHistory();
  if (list.some((x) => x.k === o.k)) return false;
  const minTs = now - MAX_AGE_DAYS * 86400_000;
  persist([...list.filter((x) => x.o >= minTs), o].slice(-MAX_OBS));
  return true;
}
export function clearHistory() { persist([]); try { ls()?.removeItem(NAMES); } catch { /* ignorato */ } }
export function exportHistory(): string {
  return JSON.stringify({ app: 'bus-torino-live', version: 1, exportedAt: new Date().toISOString(), observations: getHistory(), stopNames: stopNames() }, null, 1);
}
export function stopNames(): Record<string, string> { try { return JSON.parse(ls()?.getItem(NAMES) || '{}'); } catch { return {}; } }
export function rememberStopName(id: string, name: string) {
  const n = stopNames();
  if (n[id] === name) return;
  n[id] = name;
  try { ls()?.setItem(NAMES, JSON.stringify(n)); } catch { /* ignorato */ }
}

type Pending = { stopId: string; line: string; head: string; scheduled: number; lastPred: number; lastSeen: number };
const pending = new Map<string, Pending>();
export function resetPending() { pending.clear(); }

/**
 * Da chiamare a ogni aggiornamento di una fermata. Registra un passaggio quando una corsa con previsione
 * realtime fresca sparisce dall'elenco dopo l'orario previsto. Corse soppresse, dati datati o previsioni
 * viste troppo in anticipo non vengono registrati.
 */
export function recordSnapshot(stopId: string, arrivals: Arrival[], now: number): number {
  if (!historyEnabled()) return 0;
  const present = new Set<string>();
  for (const a of arrivals) {
    if (a.scheduled === null) continue;
    const key = `${stopId}|${a.tripId}|${dayParts(a.scheduled).d}`;
    present.add(key);
    if (a.tier === 'unavailable') { pending.delete(key); continue; }
    if (a.tier === 'live' || a.tier === 'prevision') {
      pending.set(key, { stopId, line: a.line, head: a.headsign, scheduled: a.scheduled, lastPred: a.time, lastSeen: now });
    }
  }
  let added = 0;
  for (const [key, p] of [...pending]) {
    if (p.stopId !== stopId || present.has(key)) continue;
    pending.delete(key);
    const passed = p.lastPred <= now + GRACE_MS;
    const fresh = p.lastPred - p.lastSeen <= MAX_LEAD_MS;
    if (!passed || !fresh) continue;
    const dp = dayParts(p.scheduled);
    const ok = addObservation({ k: key, s: p.stopId, l: p.line, h: p.head, d: dp.d, w: dp.w, m: dp.m, dl: Math.round((p.lastPred - p.scheduled) / 1000), o: now }, now);
    if (ok) added++;
  }
  return added;
}
