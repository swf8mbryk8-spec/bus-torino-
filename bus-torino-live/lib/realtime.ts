import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { AlertItem, VehiclePos } from './types';
import { routeById, tripInfo } from './data';

const { transit_realtime } = GtfsRealtimeBindings as any;

export const SOURCE_ID = 'GTT GTFS-RT';
const BASE = process.env.GTFS_RT_BASE || 'https://percorsieorari.gtt.to.it/das_gtfsrt';
const UA = `BusTorinoLive/0.1 (+${process.env.CONTACT_EMAIL || 'no-contact-set'})`;
/** Il feed non è richiesto più spesso di così: protegge GTT e il nostro sito. */
const TTL_MS = 15_000;
const TIMEOUT_MS = 8_000;

export type FeedKind = 'trip_update' | 'vehicle_position' | 'alerts';
export type FeedState = {
  kind: FeedKind;
  ok: boolean;
  /** ultima richiesta riuscita (epoch ms) */
  fetchedAt: number | null;
  /** timestamp scritto dal feed stesso nell'header (epoch ms) */
  headerTs: number | null;
  error: string | null;
  entities: any[];
};

const states = new Map<FeedKind, FeedState>();
const inflight = new Map<FeedKind, Promise<FeedState>>();

export const num = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return x;
  if (typeof x.toNumber === 'function') return x.toNumber();
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

async function load(kind: FeedKind): Promise<FeedState> {
  const prev = states.get(kind);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${kind}.aspx`, { signal: ctl.signal, headers: { 'User-Agent': UA }, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = new Uint8Array(await res.arrayBuffer());
    const msg = transit_realtime.FeedMessage.decode(buf);
    const hts = num(msg.header?.timestamp);
    const st: FeedState = {
      kind, ok: true, fetchedAt: Date.now(), headerTs: hts ? hts * 1000 : null, error: null, entities: msg.entity || [],
    };
    states.set(kind, st);
    return st;
  } catch (e) {
    // Non inventiamo nulla: conserviamo l'ultimo dato reale (con il suo timestamp originale) e segnaliamo l'errore.
    const st: FeedState = prev
      ? { ...prev, ok: false, error: (e as Error).message }
      : { kind, ok: false, fetchedAt: null, headerTs: null, error: (e as Error).message, entities: [] };
    states.set(kind, st);
    return st;
  } finally {
    clearTimeout(timer);
  }
}

export async function feed(kind: FeedKind): Promise<FeedState> {
  const cur = states.get(kind);
  if (cur && cur.ok && cur.fetchedAt && Date.now() - cur.fetchedAt < TTL_MS) return cur;
  // Se l'ultima richiesta è fallita da poco non martelliamo la fonte.
  if (cur && !cur.ok && cur.fetchedAt === null && Date.now() - lastTry(kind) < 5_000) return cur;
  let p = inflight.get(kind);
  if (!p) {
    tries.set(kind, Date.now());
    p = load(kind).finally(() => inflight.delete(kind));
    inflight.set(kind, p);
  }
  return p;
}
const tries = new Map<FeedKind, number>();
const lastTry = (k: FeedKind) => tries.get(k) || 0;

/** Età (ms) del dato del feed: usa il timestamp scritto dal feed, altrimenti quello di scaricamento. */
export function feedAge(s: FeedState, now = Date.now()): number | null {
  const t = s.headerTs ?? s.fetchedAt;
  return t ? now - t : null;
}

export async function getVehicles(): Promise<{ state: FeedState; vehicles: VehiclePos[] }> {
  const state = await feed('vehicle_position');
  const vehicles: VehiclePos[] = [];
  for (const e of state.entities) {
    const v = e.vehicle;
    if (!v?.position) continue;
    const tripId: string | null = v.trip?.tripId || null;
    let routeId: string | null = v.trip?.routeId || null;
    let headsign: string | null = null;
    if (tripId) {
      const ti = tripInfo(tripId);
      if (ti) { headsign = ti.headsign || null; if (!routeId) routeId = ti.routeId; }
    }
    const route = routeId ? routeById(routeId) : undefined;
    const ts = num(v.timestamp);
    vehicles.push({
      id: v.vehicle?.id || e.id,
      label: v.vehicle?.label || null,
      tripId, routeId,
      line: route?.s ?? null,
      headsign,
      lat: v.position.latitude,
      lon: v.position.longitude,
      bearing: typeof v.position.bearing === 'number' && v.position.bearing > 0 ? v.position.bearing : null,
      speed: typeof v.position.speed === 'number' ? v.position.speed : null,
      status: typeof v.currentStatus === 'number' ? v.currentStatus : null,
      stopId: v.stopId || null,
      timestamp: ts ? ts * 1000 : null,
      source: SOURCE_ID,
    });
  }
  return { state, vehicles };
}

const tr = (t: any): string => {
  const list = t?.translation || [];
  const it = list.find((x: any) => (x.language || '').startsWith('it'));
  return (it || list[0])?.text || '';
};

export async function getAlerts(): Promise<{ state: FeedState; alerts: AlertItem[] }> {
  const state = await feed('alerts');
  const now = Date.now();
  const alerts: AlertItem[] = [];
  for (const e of state.entities) {
    const a = e.alert;
    if (!a) continue;
    const periods = (a.activePeriod || []).map((p: any) => ({ s: num(p.start), e: num(p.end) }));
    let start: number | null = null, end: number | null = null;
    if (periods.length) {
      const active = periods.find((p: any) => (!p.s || p.s * 1000 <= now) && (!p.e || p.e * 1000 >= now));
      if (!active) continue; // non in corso
      start = active.s ? active.s * 1000 : null;
      end = active.e ? active.e * 1000 : null;
    }
    const ie = a.informedEntity || [];
    alerts.push({
      id: e.id,
      header: tr(a.headerText),
      description: tr(a.descriptionText),
      url: tr(a.url) || null,
      routeIds: ie.map((x: any) => x.routeId).filter(Boolean),
      stopIds: ie.map((x: any) => x.stopId).filter(Boolean),
      start, end,
    });
  }
  return { state, alerts };
}
