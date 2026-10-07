import type { Arrival, Tier } from './types';
import { routeById, routes, serviceActive, services, stopById, stopTimes, trips, tripInfo } from './data';
import { assess } from './confidence';
import { distM } from './geo';
import { feed, feedAge, getVehicles, num, SOURCE_ID, type FeedState } from './realtime';
import { serviceDays } from './time';

/**
 * Soglie scelte dal progetto (non dichiarate da GTT):
 * - un dato realtime più vecchio di STALE_MS è "DATATO";
 * - LIVE richiede anche una posizione GPS del veicolo non più vecchia di VEHICLE_FRESH_MS.
 */
export const STALE_MS = 120_000;
export const VEHICLE_FRESH_MS = 90_000;
const WINDOW_MS = 3 * 3600_000;

export type RtStatus = { ok: boolean; fetchedAt: number | null; headerTs: number | null; ageMs: number | null; error: string | null };
export type StopArrivals = {
  stopId: string;
  generatedAt: number;
  arrivals: Arrival[];
  realtime: { tripUpdates: RtStatus; vehicles: RtStatus; available: boolean };
  sources: string[];
};

const rtStatus = (s: FeedState, now: number): RtStatus => ({
  ok: s.ok, fetchedAt: s.fetchedAt, headerTs: s.headerTs, ageMs: feedAge(s, now), error: s.error,
});

/** Preferenza tra candidati della stessa corsa provenienti da fonti diverse (oggi solo GTT). */
const RANK: Record<Tier, number> = { live: 5, prevision: 4, stale: 3, scheduled: 2, unavailable: 1 };
export function pickBest(c: Arrival[]): Arrival {
  return [...c].sort((a, b) => RANK[b.tier] - RANK[a.tier] || (b.dataTimestamp ?? 0) - (a.dataTimestamp ?? 0))[0];
}

type Track = { ts: number; lat: number; lon: number; d: number };
const tracks = new Map<string, Track[]>();

/** Tendenza della distanza e movimento di un mezzo rispetto alla fermata, dalle ultime posizioni viste da questo server. */
function motion(v: { id: string; lat: number; lon: number; timestamp: number | null; speed: number | null }, stopKey: string, d: number, now: number) {
  const key = v.id + '|' + stopKey;
  const ts = v.timestamp ?? now;
  const arr = tracks.get(key) || [];
  if (!arr.length || ts > arr[arr.length - 1].ts) { arr.push({ ts, lat: v.lat, lon: v.lon, d }); if (arr.length > 6) arr.shift(); tracks.set(key, arr); }
  if (tracks.size > 6000) for (const [k, a] of tracks) if (now - a[a.length - 1].ts > 600_000) tracks.delete(k);
  const last = arr[arr.length - 1];
  const old = arr.find((x) => last.ts - x.ts >= 10_000 && last.ts - x.ts <= 180_000);
  let approaching: boolean | null = null, moving: boolean | null = null;
  if (old) {
    const dd = last.d - old.d;
    approaching = dd <= -30 ? true : dd >= 30 ? false : null;
    const moved = distM(old.lat, old.lon, last.lat, last.lon);
    if (moved >= 25) moving = true; else if (moved < 10 && last.ts - old.ts >= 30_000) moving = false;
  }
  if (typeof v.speed === 'number') moving = v.speed >= 1 ? true : v.speed < 0.5 ? false : moving;
  return { approaching, moving };
}

type StopUpd = { time: number | null; delay: number | null; skipped: boolean };

export async function stopArrivals(stopId: string, now = Date.now(), limit = 14): Promise<StopArrivals> {
  const [tu, vp] = await Promise.all([feed('trip_update'), getVehicles()]);
  const tripUpdates = new Map<string, { startDate: string | null; canceled: boolean; ts: number | null; upd: StopUpd | null; vehicleId: string | null; routeId: string | null }>();
  for (const e of tu.entities) {
    const t = e.tripUpdate;
    if (!t?.trip?.tripId) continue;
    let upd: StopUpd | null = null;
    for (const su of t.stopTimeUpdate || []) {
      if (su.stopId !== stopId) continue;
      const rel = su.scheduleRelationship; // 0 SCHEDULED, 1 SKIPPED, 2 NO_DATA
      const when = num(su.departure?.time) || num(su.arrival?.time);
      upd = {
        time: when ? when * 1000 : null,
        delay: num(su.departure?.delay) ?? num(su.arrival?.delay),
        skipped: rel === 1,
      };
      if (rel === 2) upd = null;
      break;
    }
    tripUpdates.set(t.trip.tripId, {
      startDate: t.trip.startDate || null,
      canceled: t.trip.scheduleRelationship === 3,
      ts: num(t.timestamp) ? num(t.timestamp)! * 1000 : null,
      upd,
      vehicleId: t.vehicle?.id || null,
      routeId: t.trip.routeId || null,
    });
  }
  const vehByTrip = new Map(vp.vehicles.filter((v) => v.tripId).map((v) => [v.tripId!, v]));
  const tuAge = feedAge(tu, now);
  const rtUsable = tu.fetchedAt !== null; // c'è almeno un dato reale (anche vecchio)

  const stopRef = stopById(stopId);
  const T = trips();
  const svcs = services();
  const days = serviceDays(now);
  const st = stopTimes(stopId);
  const out: Arrival[] = [];
  const seenTrips = new Set<string>();

  const build = (tripId: string, routeId: string, headsign: string, scheduled: number | null): Arrival | null => {
    const line = routeById(routeId)?.s ?? routeId;
    const rt = tripUpdates.get(tripId);
    const base = { tripId, routeId, line, headsign, scheduled, source: SOURCE_ID };
    const none = { confidence: null, why: [] as string[], distanceM: null, approaching: null, moving: null, gpsAgeMs: null, atStop: false };
    if (rt?.canceled || rt?.upd?.skipped) {
      return { ...base, tier: 'unavailable', time: scheduled ?? now, delaySec: null, dataTimestamp: tu.headerTs ?? tu.fetchedAt, vehicleId: null, ...none,
        note: rt.canceled ? 'Corsa soppressa' : 'Fermata saltata' };
    }
    let predicted: number | null = null;
    if (rt?.upd?.time) predicted = rt.upd.time;
    else if (rt?.upd?.delay !== null && rt?.upd?.delay !== undefined && scheduled !== null) predicted = scheduled + rt.upd.delay * 1000;
    if (predicted === null) {
      if (scheduled === null) return null;
      return { ...base, tier: 'scheduled', time: scheduled, delaySec: null, dataTimestamp: null, vehicleId: null, ...none,
        note: rtUsable ? 'Nessuna previsione realtime per questa corsa' : 'Dati realtime non disponibili' };
    }
    const veh = vehByTrip.get(tripId) || null;
    const vAge = veh?.timestamp ? now - veh.timestamp : null;
    const dataTs = veh?.timestamp ?? rt?.ts ?? tu.headerTs ?? tu.fetchedAt;
    const feedFresh = tuAge !== null && tuAge <= STALE_MS && tu.ok;
    let tier: Tier;
    if (!feedFresh) tier = 'stale';
    else if (veh && vAge !== null && vAge <= VEHICLE_FRESH_MS && vp.state.ok) tier = 'live';
    else tier = 'prevision';
    const delay = scheduled !== null ? Math.round((predicted - scheduled) / 1000) : (rt?.upd?.delay ?? null);
    const gpsFresh = !!(veh && vAge !== null && vAge <= VEHICLE_FRESH_MS && vp.state.ok);
    const distanceM = veh && stopRef ? Math.round(distM(veh.lat, veh.lon, stopRef.la, stopRef.lo)) : null;
    const mo = veh && distanceM !== null ? motion(veh, stopId, distanceM, now) : { approaching: null, moving: null };
    const remainingSec = (predicted - now) / 1000;
    const atStop = gpsFresh && !!veh && ((veh.status === 1 && veh.stopId === stopId) || (distanceM !== null && distanceM <= 40 && remainingSec <= 90));
    const as = assess({ tier, feedAgeMs: tuAge, gpsAgeMs: veh ? vAge : null, distanceM: gpsFresh ? distanceM : null, remainingSec, approaching: mo.approaching, moving: mo.moving });
    return { ...base, tier, time: predicted, delaySec: delay, dataTimestamp: dataTs ?? null, vehicleId: veh?.id ?? rt?.vehicleId ?? null,
      confidence: as.confidence, why: as.why, distanceM: veh ? distanceM : null, approaching: mo.approaching, moving: mo.moving, gpsAgeMs: veh ? vAge : null, atStop };
  };

  // 1) corse programmate (con eventuale previsione realtime associata via trip_id)
  for (let k = 0; k < st.length; k += 3) {
    const ti = st[k], dep = st[k + 1];
    const svc = svcs[T.svc[ti]];
    const tripId = T.ids[ti];
    for (const d of days) {
      if (!serviceActive(svc, d.date, d.dow)) continue;
      const sched = d.start + dep * 1000;
      if (sched < now - 10 * 60_000 || sched > now + WINDOW_MS + 30 * 60_000) continue;
      const rt = tripUpdates.get(tripId);
      if (rt?.startDate && rt.startDate !== d.date) continue; // previsione per un altro giorno di servizio
      const routeId = routes()[T.route[ti]].id;
      const a = build(tripId, routeId, T.heads[T.head[ti]], sched);
      if (!a) continue;
      // scartiamo ciò che è già passato da più di 30 s, tranne i dati realtime ancora validi
      if (a.time < now - 30_000) continue;
      if (a.time > now + WINDOW_MS) continue;
      seenTrips.add(tripId + '|' + d.date);
      out.push(a);
    }
  }

  // 2) corse presenti solo nel realtime per questa fermata (es. corse aggiunte)
  for (const [tripId, rt] of tripUpdates) {
    if (!rt.upd?.time || seenTrips.has(tripId + '|' + (rt.startDate || ''))) continue;
    if (out.some((o) => o.tripId === tripId)) continue;
    if (rt.upd.time < now - 30_000 || rt.upd.time > now + WINDOW_MS) continue;
    const ti = tripInfo(tripId);
    const routeId = ti?.routeId || rt.routeId;
    if (!routeId) continue;
    const a = build(tripId, routeId, ti?.headsign || '', null);
    if (a) { a.note = 'Corsa presente solo nel realtime'; out.push(a); }
  }

  out.sort((a, b) => a.time - b.time);
  const arrivals = out.slice(0, limit);
  return {
    stopId,
    generatedAt: now,
    arrivals,
    realtime: { tripUpdates: rtStatus(tu, now), vehicles: rtStatus(vp.state, now), available: rtUsable },
    sources: [SOURCE_ID + (rtUsable ? ' (realtime + orari)' : ' (solo orari)')],
  };
}
