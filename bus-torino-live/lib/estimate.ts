import { romeParts } from './time';

/**
 * Osservazione di un passaggio, salvata sul dispositivo.
 * `dl` è il ritardo osservato in secondi: ultima previsione realtime GTT vista prima del passaggio
 * meno orario programmato. Non è un rilevamento GPS dell'arrivo effettivo.
 */
export type Obs = {
  k: string;   // chiave anti-duplicato: fermata|corsa|data
  s: string;   // stop_id
  l: string;   // linea
  h: string;   // direzione (headsign)
  d: string;   // data YYYYMMDD (Europe/Rome)
  w: number;   // giorno settimana 0 = lunedì … 6 = domenica
  m: number;   // minuto del giorno dell'orario programmato
  dl: number;  // ritardo osservato (secondi)
  o: number;   // quando è stata registrata (epoch ms)
};

export type Reliability = 'high' | 'medium' | 'low';
export type Estimate = {
  ok: true;
  delaySec: number;
  time: number;
  n: number;
  days: number;
  scope: string;
  windowMin: number;
  spreadMin: number;
  p25Sec: number;
  p75Sec: number;
  reliability: Reliability;
};
export type NoEstimate = { ok: false; n: number; reason: string };

/** Ritardi oltre questa soglia (45 min) sono trattati come anomalie (deviazioni, guasti, errori di abbinamento). */
export const OUTLIER_SEC = 45 * 60;
export const MIN_OBS = 3;

export function dayParts(ts: number): { d: string; w: number; m: number } {
  const p = romeParts(ts);
  const d = `${p.y}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}`;
  const w = (new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() + 6) % 7;
  return { d, w, m: p.h * 60 + p.mi };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const dayType = (w: number) => (w <= 4 ? 'wd' : w === 5 ? 'sa' : 'su');
const DAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export function estimate(
  all: Obs[],
  q: { stop: string; line: string; head: string; scheduled: number },
): Estimate | NoEstimate {
  const { w, m } = dayParts(q.scheduled);
  const base = all.filter((o) => o.s === q.stop && o.l === q.line && Math.abs(o.dl) <= OUTLIER_SEC);
  // stessa direzione, se ce n'è abbastanza; altrimenti tutte le direzioni della linea a quella fermata
  const sameHead = base.filter((o) => o.h === q.head);
  const pool = sameHead.length >= MIN_OBS ? sameHead : base;

  const tiers = [
    { scope: `stesso giorno (${DAYS[w]})`, win: 45, f: (o: Obs) => o.w === w },
    { scope: w <= 4 ? 'giorni feriali' : w === 5 ? 'sabati' : 'domeniche', win: 60, f: (o: Obs) => dayType(o.w) === dayType(w) },
    { scope: 'tutti i giorni', win: 90, f: () => true },
  ].map((t) => ({ ...t, obs: pool.filter((o) => t.f(o) && Math.abs(o.m - m) <= t.win) }));

  const pick = tiers.find((t) => t.obs.length >= 5) ?? tiers.find((t) => t.obs.length >= MIN_OBS);
  if (!pick) {
    const n = Math.max(...tiers.map((t) => t.obs.length), 0);
    return { ok: false, n, reason: n === 0 ? 'Nessuna osservazione per questa fermata, linea e fascia oraria.' : `Solo ${n} ${n === 1 ? 'osservazione' : 'osservazioni'} (ne servono almeno ${MIN_OBS}).` };
  }
  const recent = [...pick.obs].sort((a, b) => b.o - a.o).slice(0, 40);
  const sorted = recent.map((o) => o.dl).sort((a, b) => a - b);
  const med = quantile(sorted, 0.5), p25 = quantile(sorted, 0.25), p75 = quantile(sorted, 0.75);
  const spreadMin = (p75 - p25) / 2 / 60;
  const days = new Set(recent.map((o) => o.d)).size;
  const n = recent.length;
  const specific = pick.scope !== 'tutti i giorni';
  const reliability: Reliability =
    n >= 10 && days >= 5 && spreadMin <= 2 && specific ? 'high'
    : n >= 5 && days >= 3 && spreadMin <= 5 ? 'medium'
    : 'low';
  const delaySec = Math.round(med / 60) * 60;
  return { ok: true, delaySec, time: q.scheduled + delaySec * 1000, n, days, scope: pick.scope, windowMin: pick.win, spreadMin: Math.round(spreadMin * 10) / 10, p25Sec: Math.round(p25), p75Sec: Math.round(p75), reliability };
}
