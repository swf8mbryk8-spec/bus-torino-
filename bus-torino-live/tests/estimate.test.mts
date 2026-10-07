// Stima da storico e registrazione dei passaggi (TEST 9, 10, 12 della specifica).
import { ok, done, memoryStorage } from './helpers.mts';
import type { Obs } from '../lib/estimate.ts';
const lib = async (p: string): Promise<any> => { const m: any = await import(p); return m.default && !m.estimate && !m.serviceDayStart && !m.recordSnapshot ? m.default : m; };
memoryStorage();
const { estimate, dayParts } = await lib('../lib/estimate.ts');
const { serviceDayStart } = await lib('../lib/time.ts');
const H = await lib('../lib/history.ts');

const atRome = (y: number, mo: number, d: number, h: number, mi: number) => serviceDayStart(y, mo, d) + (h * 60 + mi) * 60000 + 12 * 3600_000 - 12 * 3600_000;
const mkObs = (day: number, hh: number, mm: number, delayMin: number, stop = 'S', line = '18', head = 'CENTRO'): Obs => {
  const sched = atRome(2026, 9, day, hh, mm);
  const dp = dayParts(sched);
  return { k: `${stop}|${line}|${day}|${hh}${mm}`, s: stop, l: line, h: head, d: dp.d, w: dp.w, m: dp.m, dl: delayMin * 60, o: sched + delayMin * 60000 };
};
// 7-11 settembre 2026 = lun-ven; 12 sab; 13 dom; 14-18 lun-ven; 19 sab
const wd = [1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18].filter((d) => d !== 5 && d !== 6); // giorni 1..18 feriali (sett. 2026: 1=mar)

// nessun dato
let r = estimate([], { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 21, 18, 5) });
ok(!r.ok && r.n === 0, 'senza storico: nessuna stima, nessun dato inventato');

// 2 osservazioni: insufficienti
r = estimate([mkObs(1, 18, 5, 3), mkObs(2, 18, 5, 4)], { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 21, 18, 5) });
ok(!r.ok && r.n === 2 && /2 osservazioni/.test((r as any).reason), '2 osservazioni => "Dati insufficienti", dichiarate');

// più giorni feriali: +3,+4,+2,+5 ... mediana
const data: Obs[] = [];
const delays = [3, 4, 2, 5, 3, 4, 3, 4, 3, 2, 4, 3];
wd.slice(0, 12).forEach((d, i) => data.push(mkObs(d, 18, 5 + (i % 3 === 0 ? 1 : 0), delays[i])));
r = estimate(data, { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 21, 18, 5) });
ok(r.ok && r.n >= 10 && Math.abs((r as any).delaySec - 180) <= 60, `dopo molti giorni: stima = programmato + ~3 min (n=${(r as any).n}, +${(r as any).delaySec / 60} min, ${(r as any).scope})`);
ok(r.ok && (r as any).reliability === 'high', 'molti dati coerenti => affidabilità alta');
ok(r.ok && (r as any).time === atRome(2026, 9, 21, 18, 5) + (r as any).delaySec * 1000, 'orario stimato = programmato + ritardo mediano');

// poche osservazioni => bassa
r = estimate(data.slice(0, 3), { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 21, 18, 5) });
ok(r.ok && (r as any).reliability === 'low', '3 osservazioni => affidabilità bassa (🔴)');

// dati dispersi => non alta
const noisy = wd.slice(0, 12).map((d, i) => mkObs(d, 18, 5, [1, 15, 2, 20, 0, 18, 3, 12, 1, 22, 4, 16][i]));
r = estimate(noisy, { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 21, 18, 5) });
ok(r.ok && (r as any).reliability !== 'high', 'ritardi molto variabili => affidabilità non alta');

// feriale vs domenica: la domenica sera ha un altro comportamento
const mixed: Obs[] = [...data];
[6, 13, 20, 27].forEach((d) => mixed.push(mkObs(d, 23, 0, 9)));   // domeniche 23:00 +9 (6/13/20/27 sett. 2026 = domeniche)
const rs = estimate(mixed, { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 27, 23, 0) });
const rw = estimate(mixed, { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 22, 18, 5) });
ok(rs.ok && Math.abs((rs as any).delaySec - 540) <= 60, 'domenica 23:00 usa solo i dati della domenica sera (+9 min)');
ok(rw.ok && Math.abs((rw as any).delaySec - 180) <= 60, 'martedì 18:05 non è inquinato dai dati della domenica (+3 min)');

// altra fermata/linea non mescolate
r = estimate(data, { stop: 'ALTRA', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 21, 18, 5) });
ok(!r.ok, 'una fermata diversa non usa lo storico di un\'altra');

// anomalie escluse
r = estimate([...data, mkObs(16, 18, 5, 120)], { stop: 'S', line: '18', head: 'CENTRO', scheduled: atRome(2026, 9, 21, 18, 5) });
ok(r.ok && Math.abs((r as any).delaySec - 180) <= 60, 'un ritardo anomalo di 2 ore non sposta la stima');

// ---- registrazione dei passaggi
const arr = (tripId: string, tier: any, sched: number, time: number): any => ({ tripId, routeId: 'R', line: '18', headsign: 'CENTRO', tier, time, scheduled: sched, delaySec: null, dataTimestamp: null, vehicleId: null, source: 't' });
H.clearHistory(); H.resetPending();
const sched = atRome(2026, 9, 21, 18, 5);
let now = sched - 3 * 60000;
H.recordSnapshot('S', [arr('T1', 'live', sched, sched + 180000)], now);
H.recordSnapshot('S', [arr('T1', 'live', sched, sched + 180000)], now + 60000);
H.recordSnapshot('S', [arr('T1', 'live', sched, sched + 180000)], sched + 150000); // visto a 30 s dal passaggio
ok(H.getHistory().length === 0, 'finché la corsa è in elenco non si registra nulla');
let n = H.recordSnapshot('S', [], sched + 190000);
ok(n === 1 && H.getHistory()[0].dl === 180, 'corsa sparita dopo il passaggio => 1 osservazione, ritardo +180 s');
n = H.recordSnapshot('S', [], sched + 400000);
ok(H.getHistory().length === 1, 'nessun duplicato');

H.resetPending(); H.clearHistory();
H.recordSnapshot('S', [arr('T2', 'live', sched, sched + 120000)], sched - 20 * 60000);   // vista 22 min prima
H.recordSnapshot('S', [], sched + 120000);
ok(H.getHistory().length === 0, 'previsione vista troppo in anticipo => non registrata');

H.resetPending();
H.recordSnapshot('S', [arr('T3', 'live', sched, sched + 120000)], sched);
H.recordSnapshot('S', [arr('T3', 'unavailable', sched, sched)], sched + 30000);
H.recordSnapshot('S', [], sched + 200000);
ok(H.getHistory().length === 0, 'corsa soppressa => non registrata');

H.resetPending();
H.recordSnapshot('S', [arr('T4', 'stale', sched, sched + 120000)], sched);
H.recordSnapshot('S', [], sched + 200000);
ok(H.getHistory().length === 0, 'dato datato o solo programmato => non registrato');

H.resetPending();
H.recordSnapshot('S', [arr('T5', 'prevision', sched, sched + 600000)], sched);
H.recordSnapshot('S', [], sched + 100000);
ok(H.getHistory().length === 0, 'corsa sparita prima dell\'orario previsto (feed interrotto) => non registrata');

H.setHistoryEnabled(false); H.resetPending();
H.recordSnapshot('S', [arr('T6', 'live', sched, sched)], sched - 60000); H.recordSnapshot('S', [], sched + 100000);
ok(H.getHistory().length === 0, 'raccolta disattivata dall\'utente => nulla viene salvato');
H.setHistoryEnabled(true);

// persistenza: "riavvio" = nuova lettura da localStorage
H.recordSnapshot('S', [arr('T7', 'live', sched, sched + 60000)], sched - 60000); H.recordSnapshot('S', [], sched + 100000);
const raw = (globalThis as any).localStorage.getItem('btl:history:v1');
ok(JSON.parse(raw).length === 1 && !/lat|lon|pos/i.test(raw), 'storico persistito in localStorage, senza coordinate né dati personali');
done('estimate/history');
