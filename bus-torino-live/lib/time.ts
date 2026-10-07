const TZ = 'Europe/Rome';

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number };

export function romeParts(ts: number): Parts {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ts))) if (p.type !== 'literal') o[p.type] = +p.value;
  return { y: o.year, m: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
}

/** Offset (ms) di Europe/Rome rispetto a UTC a un dato istante. */
function offsetMs(ts: number): number {
  const p = romeParts(ts);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ts / 1000) * 1000;
}

/**
 * Inizio del "giorno di servizio" GTFS: mezzogiorno locale meno 12 ore
 * (così le ore oltre le 24:00 restano corrette anche nei cambi di ora legale).
 */
export function serviceDayStart(y: number, m: number, d: number): number {
  const noonUtcGuess = Date.UTC(y, m - 1, d, 12, 0, 0);
  const noonLocal = noonUtcGuess - offsetMs(noonUtcGuess);
  return noonLocal - 12 * 3600 * 1000;
}

export function ymd(y: number, m: number, d: number): string {
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/** Giorni di servizio da considerare attorno a `now` (ieri, oggi, domani). */
export function serviceDays(now: number): { date: string; dow: number; start: number }[] {
  const out: { date: string; dow: number; start: number }[] = [];
  const p = romeParts(now);
  for (const delta of [-1, 0, 1]) {
    const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    const dow = (dt.getUTCDay() + 6) % 7; // 0 = lunedì
    out.push({ date: ymd(y, m, d), dow, start: serviceDayStart(y, m, d) });
  }
  return out;
}

export function fmtClock(ts: number): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ts));
}
