import type { Tier } from './types';

export type Conf = 'high' | 'medium' | 'low';
export type ConfInput = {
  tier: Tier;
  feedAgeMs: number | null;
  gpsAgeMs: number | null;
  distanceM: number | null;
  remainingSec: number;
  approaching: boolean | null;
  moving: boolean | null;
};

const s = (ms: number) => Math.round(ms / 1000);

/**
 * Affidabilità di un passaggio con previsione realtime. Regole esplicite (scelte del progetto, non di GTT):
 *  dato del feed ≤60 s +1, >120 s −2 · GPS ≤45 s +2, ≤90 s +1 · previsione coerente con la distanza (1,5–20 m/s) +1,
 *  incoerente (>25 m/s) −2 · mezzo che si avvicina +1, che si allontana a ≤5 min −2 · passaggio entro 10 min +1, oltre 20 min −1.
 *  Si parte da +1 per la presenza di una previsione GTT. Punteggio ≥4 alta, 2–3 media, altrimenti bassa.
 *  Limiti: senza GPS recente non è mai alta; previsione incoerente con la distanza => bassa; mezzo che si allontana o
 *  passaggio oltre 20 min => al massimo media; dato datato => sempre bassa.
 */
export function assess(i: ConfInput): { confidence: Conf; score: number; why: string[] } {
  let score = 1;
  let capLow = false, capMedium = false;
  const why: string[] = [];
  const fresh = i.gpsAgeMs !== null && i.gpsAgeMs <= 90_000;

  if (i.feedAgeMs === null) why.push('età del dato realtime non nota');
  else if (i.feedAgeMs <= 60_000) { score += 1; why.push(`dato realtime di ${s(i.feedAgeMs)} s fa`); }
  else if (i.feedAgeMs <= 120_000) why.push(`dato realtime di ${s(i.feedAgeMs)} s fa`);
  else { score -= 2; why.push(`dato realtime vecchio (${Math.round(i.feedAgeMs / 60000)} min)`); }

  if (i.gpsAgeMs === null) why.push('nessuna posizione GPS per questa corsa');
  else if (i.gpsAgeMs <= 45_000) { score += 2; why.push(`posizione GPS di ${s(i.gpsAgeMs)} s fa`); }
  else if (i.gpsAgeMs <= 90_000) { score += 1; why.push(`posizione GPS di ${s(i.gpsAgeMs)} s fa`); }
  else why.push(`posizione GPS datata (${Math.round(i.gpsAgeMs / 60000)} min)`);

  if (fresh && i.distanceM !== null) {
    const v = i.distanceM / Math.max(i.remainingSec, 1);
    if (v > 25) { score -= 2; capLow = true; why.push(`previsione incoerente con la distanza (${Math.round(i.distanceM)} m in ${Math.max(0, Math.round(i.remainingSec))} s)`); }
    else if (v >= 1.5 || i.distanceM <= 120) { score += 1; why.push(`previsione coerente con la distanza (${Math.round(i.distanceM)} m)`); }
    if (i.approaching === true) { score += 1; why.push('si sta avvicinando'); }
    if (i.approaching === false && i.remainingSec <= 300) { score -= 2; capMedium = true; why.push('sembra allontanarsi dalla fermata'); }
  }

  if (i.remainingSec <= 600) score += 1;
  else if (i.remainingSec > 1200) { score -= 1; capMedium = true; why.push('passaggio lontano nel tempo'); }

  let confidence: Conf = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  if ((!fresh || capMedium) && confidence === 'high') confidence = 'medium';
  if (capLow) confidence = 'low';
  if (i.tier === 'stale') { confidence = 'low'; why.unshift('dato realtime non aggiornato'); }
  return { confidence, score, why };
}
