// Affidabilità del passaggio e conto alla rovescia (punti 22-27 della specifica).
import { ok, done } from './helpers.mts';
const lib = async (p: string): Promise<any> => { const m: any = await import(p); return m.default && Object.keys(m).length <= 1 ? m.default : m; };
const { assess } = await lib('../lib/confidence.ts');
const { phase } = await lib('../lib/countdown.ts');
const { distM } = await lib('../lib/geo.ts');

const base = { tier: 'live', feedAgeMs: 10_000, gpsAgeMs: 15_000, distanceM: 450, remainingSec: 180, approaching: true, moving: true };
let r = assess(base);
ok(r.confidence === 'high', `GPS fresco, dato fresco, coerente e in avvicinamento => ALTA (punteggio ${r.score})`);
ok(r.why.some((w: string) => /GPS/.test(w)) && r.why.some((w: string) => /coerente/.test(w)), 'i motivi sono elencati');

r = assess({ ...base, tier: 'prevision', gpsAgeMs: null, distanceM: null, approaching: null, moving: null });
ok(r.confidence === 'medium', 'previsione GTT senza GPS => mai alta (media)');

r = assess({ ...base, distanceM: 6000, remainingSec: 60 });
ok(r.confidence !== 'high' && r.why.some((w: string) => /incoerente/.test(w)), 'bus a 6 km previsto tra 1 min => incoerente, non alta');

r = assess({ ...base, approaching: false, remainingSec: 120 });
ok(r.confidence !== 'high' && r.why.some((w: string) => /allontan/.test(w)), 'mezzo che si allontana => non alta');

r = assess({ ...base, tier: 'stale', feedAgeMs: 400_000 });
ok(r.confidence === 'low', 'dato realtime vecchio di 6-7 minuti => BASSA');

r = assess({ ...base, gpsAgeMs: 300_000 });
ok(r.confidence !== 'high', 'GPS vecchio di 5 minuti => non alta');

r = assess({ ...base, remainingSec: 2400 });
ok(r.confidence !== 'high', 'passaggio tra 40 minuti => non alta');

// conto alla rovescia: 8 → 7 → 6 min → in arrivo
const now0 = 1_000_000_000_000;
const a: any = { tier: 'live', time: now0 + 8 * 60000, atStop: false, distanceM: 2000, approaching: true };
const seq = [0, 60, 120, 240, 420].map((s) => phase(a, now0 + s * 1000));
ok(seq[0].kind === 'minutes' && seq[0].mins === 8, 'T+0: 8 min');
ok(seq[1].mins === 7 && seq[2].mins === 6, 'dopo 1 e 2 minuti: 7 min, 6 min (senza ricaricare)');
ok(seq[3].mins === 4, 'dopo 4 minuti: 4 min');
ok(seq[4].kind === 'minutes' && seq[4].mins === 1, 'a 60 s: 1 min');
ok(phase(a, now0 + 8 * 60000 - 30000).kind === 'imminent', 'a 30 s: "In arrivo"');
ok(phase({ ...a, atStop: true }, now0 + 8 * 60000 - 20000).kind === 'arrived', 'mezzo alla fermata => "Alla fermata"');
ok(phase({ ...a, atStop: true, tier: 'stale' }, now0 + 8 * 60000 - 20000).kind === 'imminent', 'con dato datato non si dichiara mai "Alla fermata"');
ok(phase(a, now0 + 8 * 60000 + 200000).kind === 'passed', '3 minuti dopo l\'orario previsto il passaggio sparisce dall\'elenco');
ok(phase({ ...a, tier: 'scheduled' }, now0).kind === 'clock', 'orario programmato: solo orario, mai countdown in minuti');
ok(phase({ ...a, tier: 'live', time: now0 + 600000, distanceM: 100, approaching: true }, now0 + 560000).kind === 'imminent', 'GPS a 100 m, si avvicina => "In arrivo"');

const d = distM(45.0, 7.7, 45.004, 7.7);
ok(Math.abs(d - 445) < 5, `distanza GPS-fermata ≈ 445 m (${Math.round(d)} m)`);
done('confidence/countdown');
