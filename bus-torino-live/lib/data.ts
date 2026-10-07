import fs from 'node:fs';
import path from 'node:path';
import type { Route, Service, Stop } from './types';

const DIR = path.join(process.cwd(), 'data');

type TripsFile = { ids: string[]; route: number[]; head: number[]; svc: number[]; dir: number[]; heads: string[] };
export type Meta = {
  generatedAt: string; source: string;
  counts: { routes: number; stops: number; trips: number; stopsWithTimes: number };
  serviceRange: { from: string; to: string }; feedInfo: Record<string, string> | null;
};

const cache: {
  meta?: Meta | null; stops?: Stop[]; stopById?: Map<string, Stop>; routes?: Route[];
  routeById?: Map<string, Route>; routesByShort?: Map<string, Route[]>;
  services?: Service[]; trips?: TripsFile; tripIdx?: Map<string, number>;
} = {};

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as T;
export const safe = (id: string) => encodeURIComponent(id).replace(/%/g, '_');

export function dataAvailable(): boolean {
  return fs.existsSync(path.join(DIR, 'meta.json'));
}
export function meta(): Meta | null {
  if (cache.meta === undefined) cache.meta = dataAvailable() ? readJson<Meta>('meta.json') : null;
  return cache.meta;
}
export function stops(): Stop[] {
  if (!cache.stops) { cache.stops = readJson<Stop[]>('stops.json'); cache.stopById = new Map(cache.stops.map((s) => [s.i, s])); }
  return cache.stops;
}
export function stopById(id: string): Stop | undefined { stops(); return cache.stopById!.get(id); }
export function routes(): Route[] {
  if (!cache.routes) {
    cache.routes = readJson<Route[]>('routes.json');
    cache.routeById = new Map(cache.routes.map((r) => [r.id, r]));
    cache.routesByShort = new Map();
    for (const r of cache.routes) {
      const k = r.s.toLowerCase();
      const a = cache.routesByShort.get(k) || [];
      a.push(r);
      cache.routesByShort.set(k, a);
    }
  }
  return cache.routes;
}
export function routeById(id: string): Route | undefined { routes(); return cache.routeById!.get(id); }
export function routesByShort(short: string): Route[] { routes(); return cache.routesByShort!.get(short.toLowerCase()) || []; }
export function services(): Service[] { return (cache.services ||= readJson<Service[]>('services.json')); }
export function trips(): TripsFile {
  if (!cache.trips) { cache.trips = readJson<TripsFile>('trips.json'); cache.tripIdx = new Map(cache.trips.ids.map((t, i) => [t, i])); }
  return cache.trips;
}
export function tripIndex(tripId: string): number | undefined { trips(); return cache.tripIdx!.get(tripId); }
export function tripInfo(tripId: string): { routeId: string; headsign: string } | null {
  const i = tripIndex(tripId);
  if (i === undefined) return null;
  const t = trips();
  return { routeId: routes()[t.route[i]].id, headsign: t.heads[t.head[i]] };
}
/** Triple [tripIdx, departureSecs, stopSequence] per la fermata. */
export function stopTimes(stopId: string): number[] {
  const f = path.join(DIR, 'stop-times', safe(stopId) + '.json');
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as number[]) : [];
}
export type RouteDetail = { directions: { dir: number; head: string; stops: string[]; shape: [number, number][] }[] };
export function routeDetail(routeId: string): RouteDetail | null {
  const f = path.join(DIR, 'routes', safe(routeId) + '.json');
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as RouteDetail) : null;
}
export function serviceActive(s: Service, date: string, dow: number): boolean {
  if (s.rem.includes(date)) return false;
  if (s.add.includes(date)) return true;
  return s.d[dow] === 1 && date >= s.s && date <= s.e;
}
