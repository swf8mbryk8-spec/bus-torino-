import { routes, stops } from './data';
import type { Stop } from './types';

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Distanza di Levenshtein con soglia: restituisce max+1 se supera `max`. */
export function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Errori di battitura ammessi in base alla lunghezza della parola (i numeri non ammettono errori). */
const maxErr = (t: string) => (/\d/.test(t) ? 0 : t.length <= 3 ? 0 : t.length <= 6 ? 1 : 2);

/**
 * Costo di una parola cercata rispetto alle parole di un testo:
 * 0 identica, 1 inizio di parola, 2 contenuta in una parola, 3+ con errori di battitura; null se non trovata.
 */
function tokenCost(q: string, toks: string[]): number | null {
  let best: number | null = null;
  const upd = (c: number) => { if (best === null || c < best) best = c; };
  for (const t of toks) {
    if (t === q) return 0;
    if (t.startsWith(q)) upd(1);
    else if (q.length >= 3 && t.includes(q)) upd(2);
    else {
      const m = maxErr(q);
      if (m > 0) {
        const d = Math.min(lev(q, t, m), q.length < t.length ? lev(q, t.slice(0, q.length), m) : m + 1);
        if (d <= m) upd(3 + d);
      }
    }
  }
  return best;
}

type SIdx = { s: Stop; toks: string[] };
type RIdx = { short: string; sn: string; name: string; toks: string[] };
let sidx: SIdx[] | null = null;
let ridx: RIdx[] | null = null;

function init() {
  if (sidx) return;
  sidx = stops().map((s) => ({ s, toks: norm(`${s.n} ${s.d || ''} ${s.c}`).split(' ').filter(Boolean) }));
  const seen = new Set<string>();
  ridx = [];
  for (const r of routes()) {
    const k = r.s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    ridx.push({ short: r.s, sn: norm(r.s), name: r.l, toks: norm(r.l).split(' ').filter(Boolean) });
  }
}

export type SearchResult =
  | { type: 'line'; id: string; line: string; name: string; fuzzy: boolean }
  | { type: 'stop'; id: string; code: string; name: string; desc: string; lines: string[]; lat: number; lon: number; fuzzy: boolean };

/** Costo complessivo di tutte le parole della ricerca; null se anche una sola non è trovata. */
function score(qs: string[], toks: string[]): { cost: number; fuzzy: boolean } | null {
  let cost = 0, fuzzy = false;
  for (const q of qs) {
    const c = tokenCost(q, toks);
    if (c === null) return null;
    if (c >= 3) fuzzy = true;
    cost += c;
  }
  return { cost, fuzzy };
}

export function search(q: string): SearchResult[] {
  init();
  const nq = norm(q);
  if (!nq) return [];
  const qs = nq.split(' ');
  const out: SearchResult[] = [];

  // linee: numero esatto, numero che inizia così (45 → 45B), poi nome del percorso (comuni, destinazioni)
  const lines: { r: RIdx; cost: number; fuzzy: boolean }[] = [];
  for (const r of ridx!) {
    if (r.sn === nq) lines.push({ r, cost: 0, fuzzy: false });
    else if (qs.length === 1 && /^\d/.test(nq) && r.sn.startsWith(nq)) lines.push({ r, cost: 1, fuzzy: false });
    else if (!/^\d+$/.test(nq)) {
      const sc = score(qs, r.toks);
      if (sc) lines.push({ r, cost: 10 + sc.cost, fuzzy: sc.fuzzy });
    }
  }
  lines.sort((a, b) => a.cost - b.cost || a.r.short.localeCompare(b.r.short, 'it', { numeric: true }));
  for (const l of lines.slice(0, 8)) out.push({ type: 'line', id: l.r.short, line: l.r.short, name: l.r.name, fuzzy: l.fuzzy });

  // fermate: codice esatto in cima, poi tutte le parole (tolleranti agli errori)
  const cand: { s: Stop; cost: number; fuzzy: boolean }[] = [];
  const raw = q.trim();
  for (const x of sidx!) {
    if (x.s.c && x.s.c === raw) { cand.push({ s: x.s, cost: -1, fuzzy: false }); continue; }
    const sc = score(qs, x.toks);
    if (sc) cand.push({ s: x.s, cost: sc.cost, fuzzy: sc.fuzzy });
  }
  cand.sort((a, b) => a.cost - b.cost || a.s.n.length - b.s.n.length || a.s.n.localeCompare(b.s.n, 'it'));
  for (const c of cand.slice(0, 14)) {
    out.push({ type: 'stop', id: c.s.i, code: c.s.c, name: c.s.n, desc: c.s.d, lines: c.s.r.slice(0, 10), lat: c.s.la, lon: c.s.lo, fuzzy: c.fuzzy });
  }
  return out;
}
