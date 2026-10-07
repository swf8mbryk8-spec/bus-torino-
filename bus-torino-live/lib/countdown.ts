import type { Arrival } from './types';

export type Phase =
  | { kind: 'arrived' }
  | { kind: 'imminent' }
  | { kind: 'minutes'; mins: number }
  | { kind: 'clock' }
  | { kind: 'passed' }
  | { kind: 'none' };

/** Cosa mostrare al posto dell'orario, in base a quanto manca (ricalcolato a ogni tick dell'orologio). */
export function phase(a: Pick<Arrival, 'tier' | 'time' | 'atStop' | 'distanceM' | 'approaching'>, now: number): Phase {
  if (a.tier === 'unavailable') return { kind: 'none' };
  if (a.tier === 'scheduled') return { kind: 'clock' };
  const sec = (a.time - now) / 1000;
  if (sec < -90) return { kind: 'passed' };
  if (a.tier !== 'stale' && a.atStop && sec <= 90) return { kind: 'arrived' };
  const near = a.tier === 'live' && a.distanceM !== null && a.distanceM <= 150 && a.approaching !== false && sec <= 90;
  if (sec <= 45 || near) return { kind: 'imminent' };
  return { kind: 'minutes', mins: Math.max(1, Math.round(sec / 60)) };
}
