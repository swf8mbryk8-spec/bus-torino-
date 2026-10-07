// Ricerca linee e fermate (TEST 1-5, 7 della specifica) su un piccolo GTFS di prova creato solo per il test.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ok, done } from './helpers.mts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btl-'));
fs.mkdirSync(path.join(tmp, 'data'));
process.chdir(tmp);
const st = (i: string, c: string, n: string, r: string[], d = '') => ({ i, c, n, d, la: 45, lo: 7.6, r });
fs.writeFileSync('data/stops.json', JSON.stringify([
  st('1', '3000', 'PORTA NUOVA', ['4', '18', '55']), st('2', '3001', 'PORTA NUOVA', ['68'], 'Lato Corso Vittorio'),
  st('3', '3002', 'PORTA SUSA', ['55', '68']), st('4', '2500', 'XX SETTEMBRE', ['18'], 'Via XX Settembre'),
  st('5', '2501', 'XX SETTEMBRE/PORTA PALAZZO', ['55']), st('6', '9100', 'TORINO N.53 TROFARELLO', ['45', '45B']),
  st('7', '7777', 'FALCHERA CAP.', ['3']), st('8', '1111', 'MIRAFIORI SUD - VIA ONORATO VIGLIANI', ['63', '18']),
  st('9', '1112', 'PIAZZA CASTELLO', ['4']),
]));
const R = (id: string, s: string, l: string) => ({ id, s, l, t: 3 });
fs.writeFileSync('data/routes.json', JSON.stringify([R('r4', '4', 'Falchera - Stazione Stura'), R('r18', '18', 'Mirafiori - Centro'), R('r55', '55', 'Porta Susa - Lingotto'), R('r68', '68', 'Barca - Mirafiori'), R('r45', '45', 'Torino - Trofarello - Santena'), R('r45b', '45B', 'Torino - Santena'), R('r3', '3', 'Falchera - Centro')]));
fs.writeFileSync('data/meta.json', '{}');
const m: any = await import('../lib/search.ts');
const { search } = m.default && !m.search ? m.default : m;
const names = (q: string) => search(q).filter((x: any) => x.type === 'stop').map((x: any) => `${x.name}#${x.code}`);
const lines = (q: string) => search(q).filter((x: any) => x.type === 'line').map((x: any) => x.line);

ok(lines('18')[0] === '18' && lines('55')[0] === '55' && lines('68')[0] === '68', 'TEST 1: linee 18, 55, 68 (non tra le 3 iniziali) trovate');
ok(lines('45').includes('45B') && lines('45')[0] === '45', 'linea 45 con la variante 45B');
ok(names('Via XX Settembre').some((n: string) => n.startsWith('XX SETTEMBRE#2500')), 'TEST 2: "Via XX Settembre" trova la fermata anche se il nome non la contiene');
ok(names('mirafiori').length === 1 && names('mirafiori')[0].includes('MIRAFIORI SUD'), 'TEST 3: fermata di un\'altra zona trovata');
ok(names('porta nuova').length === 2, 'TEST 4: minuscolo trova entrambe le fermate omonime (da scegliere)');
const typo = search('porta nuva').filter((x: any) => x.type === 'stop');
ok(typo.length >= 2 && typo[0].name === 'PORTA NUOVA' && typo.every((x: any) => x.fuzzy) , 'TEST 5: "porta nuva" suggerisce PORTA NUOVA (segnalato come suggerimento)');
ok(names('trofarello')[0]?.includes('TROFARELLO'), 'ricerca per comune/zona nel nome fermata');
ok(names('3002')[0] === 'PORTA SUSA#3002', 'ricerca per codice fermata');
ok(names('9100')[0].includes('TROFARELLO') && search('9100').find((x: any) => x.type === 'stop').lines.includes('45B'), 'codice fermata mostra le linee che passano');
ok(names('Piazza Casttello')[0]?.startsWith('PIAZZA CASTELLO'), 'errore di battitura in una parola intermedia');
ok(names('xyzqwerty').length === 0 && lines('xyzqwerty').length === 0, 'nessun risultato inventato per testo senza corrispondenze');
ok(lines('trofarello').includes('45'), 'ricerca linee per destinazione/comune');
ok(names('porta').length >= 3 && names('porta').every((n: string) => /PORTA/.test(n)), 'ricerca parziale ("porta") elenca più fermate');
ok(names('').length === 0, 'ricerca vuota => nessun risultato');
done('search');
