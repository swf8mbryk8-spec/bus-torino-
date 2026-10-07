/**
 * Scarica il GTFS statico e genera indici compatti in ./data.
 * Nessun dato è scritto a mano: linee, fermate, orari e percorsi derivano solo dal feed.
 * Eseguito automaticamente da `npm run build`.
 */
import { unzipSync, strFromU8 } from 'fflate';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';

const URL_STATIC = process.env.GTFS_STATIC_URL || 'https://www.gtt.to.it/open_data/gtt_gtfs.zip';
const OUT = path.join(process.cwd(), 'data');

type Row = Record<string, string>;

function splitCsvLine(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function* rows(text: string): Generator<Row> {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let start = 0;
  let header: string[] | null = null;
  const len = text.length;
  while (start < len) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = len;
    let line = text.slice(start, end);
    start = end + 1;
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (!line) continue;
    const cells = splitCsvLine(line);
    if (!header) { header = cells.map((h) => h.trim()); continue; }
    const r: Row = {};
    for (let i = 0; i < header.length; i++) r[header[i]] = cells[i] ?? '';
    yield r;
  }
}

function timeToSecs(t: string): number | null {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

const safe = (id: string) => encodeURIComponent(id).replace(/%/g, '_');

async function main() {
  console.log('Scarico GTFS statico da', URL_STATIC);
  let zip: Uint8Array | null = null;
  try {
    const res = await fetch(URL_STATIC, { headers: { 'User-Agent': 'BusTorinoLive/0.1 (build)' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    zip = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    if (existsSync(path.join(OUT, 'meta.json'))) {
      console.warn('Download fallito, riuso i dati già presenti in ./data:', (e as Error).message);
      return;
    }
    throw new Error('Impossibile scaricare il GTFS statico e non ci sono dati precedenti: ' + (e as Error).message);
  }

  const files = unzipSync(zip);
  const need = (n: string) => {
    const f = files[n];
    if (!f) throw new Error(`File GTFS mancante nello zip: ${n}`);
    return strFromU8(f);
  };
  const opt = (n: string) => (files[n] ? strFromU8(files[n]) : '');

  // --- routes
  const routes: { id: string; s: string; l: string; t: number }[] = [];
  const routeIdx = new Map<string, number>();
  for (const r of rows(need('routes.txt'))) {
    routeIdx.set(r.route_id, routes.length);
    routes.push({ id: r.route_id, s: r.route_short_name || r.route_id, l: r.route_long_name || '', t: +r.route_type || 3 });
  }

  // --- services
  const svc = new Map<string, { id: string; d: number[]; s: string; e: string; add: string[]; rem: string[] }>();
  for (const r of rows(opt('calendar.txt'))) {
    svc.set(r.service_id, {
      id: r.service_id,
      d: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((k) => +r[k] || 0),
      s: r.start_date, e: r.end_date, add: [], rem: [],
    });
  }
  for (const r of rows(opt('calendar_dates.txt'))) {
    let s = svc.get(r.service_id);
    if (!s) { s = { id: r.service_id, d: [0, 0, 0, 0, 0, 0, 0], s: '99999999', e: '00000000', add: [], rem: [] }; svc.set(r.service_id, s); }
    (r.exception_type === '1' ? s.add : s.rem).push(r.date);
  }
  const services = [...svc.values()];
  const svcIdx = new Map(services.map((s, i) => [s.id, i]));

  // --- trips
  const tripIds: string[] = [];
  const tripRoute: number[] = [];
  const tripHead: number[] = [];
  const tripSvc: number[] = [];
  const tripDir: number[] = [];
  const tripShape: string[] = [];
  const heads: string[] = [];
  const headIdx = new Map<string, number>();
  const tripIdx = new Map<string, number>();
  for (const r of rows(need('trips.txt'))) {
    const ri = routeIdx.get(r.route_id);
    const si = svcIdx.get(r.service_id);
    if (ri === undefined || si === undefined) continue;
    const h = r.trip_headsign || '';
    let hi = headIdx.get(h);
    if (hi === undefined) { hi = heads.length; heads.push(h); headIdx.set(h, hi); }
    tripIdx.set(r.trip_id, tripIds.length);
    tripIds.push(r.trip_id);
    tripRoute.push(ri);
    tripHead.push(hi);
    tripSvc.push(si);
    tripDir.push(+r.direction_id || 0);
    tripShape.push(r.shape_id || '');
  }

  // --- stops
  const stops = new Map<string, { i: string; c: string; n: string; d: string; la: number; lo: number; r: Set<string> }>();
  for (const r of rows(need('stops.txt'))) {
    if (r.location_type && r.location_type !== '0') continue;
    const la = parseFloat(r.stop_lat), lo = parseFloat(r.stop_lon);
    if (!isFinite(la) || !isFinite(lo)) continue;
    stops.set(r.stop_id, { i: r.stop_id, c: r.stop_code || '', n: r.stop_name || r.stop_id, d: r.stop_desc || '', la, lo, r: new Set() });
  }

  // --- stop_times: per-fermata e per-corsa (per i pattern)
  console.log('Leggo stop_times.txt (può richiedere un po\')...');
  const perStop = new Map<string, number[]>();
  const perTrip = new Map<number, { seq: number; stop: string }[]>();
  for (const r of rows(need('stop_times.txt'))) {
    const ti = tripIdx.get(r.trip_id);
    if (ti === undefined || !stops.has(r.stop_id)) continue;
    const dep = timeToSecs(r.departure_time || r.arrival_time);
    if (dep === null) continue; // nessun orario inventato: righe senza orario sono ignorate
    const seq = +r.stop_sequence;
    let a = perStop.get(r.stop_id);
    if (!a) { a = []; perStop.set(r.stop_id, a); }
    a.push(ti, dep, seq);
    let t = perTrip.get(ti);
    if (!t) { t = []; perTrip.set(ti, t); }
    t.push({ seq, stop: r.stop_id });
  }

  // --- pattern per linea/direzione (il più frequente)
  const patterns = new Map<string, { count: number; stops: string[]; trip: number }>();
  for (const [ti, list] of perTrip) {
    list.sort((a, b) => a.seq - b.seq);
    const ids = list.map((x) => x.stop);
    const key = `${tripRoute[ti]}|${tripDir[ti]}|${ids.join('>')}`;
    const p = patterns.get(key);
    if (p) p.count++;
    else patterns.set(key, { count: 1, stops: ids, trip: ti });
    const rid = routes[tripRoute[ti]].s;
    for (const s of ids) stops.get(s)!.r.add(rid);
  }
  const bestByRouteDir = new Map<string, { count: number; stops: string[]; trip: number }>();
  for (const [key, p] of patterns) {
    const [ri, dir] = key.split('|');
    const k = `${ri}|${dir}`;
    const cur = bestByRouteDir.get(k);
    if (!cur || p.count > cur.count) bestByRouteDir.set(k, p);
  }

  // --- shapes (solo quelle usate)
  const wantedShapes = new Set<string>();
  for (const p of bestByRouteDir.values()) if (tripShape[p.trip]) wantedShapes.add(tripShape[p.trip]);
  const shapes = new Map<string, { seq: number; la: number; lo: number }[]>();
  for (const r of rows(opt('shapes.txt'))) {
    if (!wantedShapes.has(r.shape_id)) continue;
    let a = shapes.get(r.shape_id);
    if (!a) { a = []; shapes.set(r.shape_id, a); }
    a.push({ seq: +r.shape_pt_sequence, la: +r.shape_pt_lat, lo: +r.shape_pt_lon });
  }

  // --- scrittura
  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(path.join(OUT, 'routes'), { recursive: true });
  mkdirSync(path.join(OUT, 'stop-times'), { recursive: true });
  const w = (f: string, d: unknown) => writeFileSync(path.join(OUT, f), JSON.stringify(d));

  w('routes.json', routes);
  w('services.json', services);
  w('trips.json', { ids: tripIds, route: tripRoute, head: tripHead, svc: tripSvc, dir: tripDir, heads });
  w('stops.json', [...stops.values()].map((s) => ({ ...s, r: [...s.r].sort() })));
  for (const [id, arr] of perStop) w(`stop-times/${safe(id)}.json`, arr);

  const byRoute = new Map<number, any[]>();
  for (const [k, p] of bestByRouteDir) {
    const [ri, dir] = k.split('|').map(Number);
    const shp = (shapes.get(tripShape[p.trip]) || []).sort((a, b) => a.seq - b.seq).map((x) => [+x.la.toFixed(5), +x.lo.toFixed(5)]);
    const arr = byRoute.get(ri) || [];
    arr.push({ dir, head: heads[tripHead[p.trip]], stops: p.stops, shape: shp });
    byRoute.set(ri, arr);
  }
  for (const [ri, dirs] of byRoute) w(`routes/${safe(routes[ri].id)}.json`, { directions: dirs.sort((a, b) => a.dir - b.dir) });

  let minD = '99999999', maxD = '00000000';
  for (const s of services) {
    for (const d of [s.s, ...s.add]) if (d && d < minD) minD = d;
    for (const d of [s.e, ...s.add]) if (d && d !== '00000000' && d > maxD) maxD = d;
  }
  w('meta.json', {
    generatedAt: new Date().toISOString(),
    source: URL_STATIC,
    counts: { routes: routes.length, stops: stops.size, trips: tripIds.length, stopsWithTimes: perStop.size },
    serviceRange: { from: minD, to: maxD },
    feedInfo: opt('feed_info.txt') ? [...rows(opt('feed_info.txt'))][0] ?? null : null,
  });
  console.log(`Fatto: ${routes.length} linee, ${stops.size} fermate, ${tripIds.length} corse.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
