import { guard, json } from '@/lib/http';
import { dataAvailable, routeById, routesByShort, stopById, tripIndex } from '@/lib/data';
import { feed, feedAge, getVehicles } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * Misura sul feed reale: copertura delle linee, età dei dati e corrispondenza ID statico/realtime.
 * Serve a verificare, sul deploy, ciò che dalla fase di ricerca non era dimostrabile.
 */
export function GET(req: Request) {
  return guard(req, async () => {
    if (!dataAvailable()) return json({ error: 'Dati GTFS non ancora generati.' }, { status: 503 });
    const lines = (new URL(req.url).searchParams.get('lines') || '45,81,43').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    const now = Date.now();
    const [tu, al] = await Promise.all([feed('trip_update'), feed('alerts')]);
    const { state: vs, vehicles } = await getVehicles();

    const tuTrips = tu.entities.filter((e) => e.tripUpdate?.trip?.tripId);
    const tripMatch = tuTrips.filter((e) => tripIndex(e.tripUpdate.trip.tripId) !== undefined).length;
    let stopRefs = 0, stopMatch = 0;
    for (const e of tuTrips) for (const su of e.tripUpdate.stopTimeUpdate || []) { stopRefs++; if (su.stopId && stopById(su.stopId)) stopMatch++; }
    const vehTrip = vehicles.filter((v) => v.tripId);
    const vehMatch = vehTrip.filter((v) => tripIndex(v.tripId!) !== undefined).length;

    const perLine = lines.map((l) => {
      const rs = routesByShort(l);
      const ids = new Set(rs.map((r) => r.id));
      const tuOn = tuTrips.filter((e) => {
        const rid = e.tripUpdate.trip.routeId;
        return (rid && ids.has(rid)) || false;
      }).length;
      return {
        line: l,
        inStaticGtfs: rs.length > 0,
        routeIds: rs.map((r) => r.id),
        tripUpdatesInFeed: tuOn,
        vehiclesInFeed: vehicles.filter((v) => v.routeId && ids.has(v.routeId)).length,
      };
    });
    const unknownRouteIds = new Set(tuTrips.map((e) => e.tripUpdate.trip.routeId).filter((r: string) => r && !routeById(r))).size;

    return json({
      generatedAt: now,
      feeds: {
        trip_update: { ok: tu.ok, entities: tu.entities.length, ageMs: feedAge(tu, now), error: tu.error },
        vehicle_position: { ok: vs.ok, entities: vs.entities.length, ageMs: feedAge(vs, now), error: vs.error },
        alerts: { ok: al.ok, entities: al.entities.length, ageMs: feedAge(al, now), error: al.error },
      },
      idMatching: {
        tripUpdateTripIdsInStatic: { total: tuTrips.length, matched: tripMatch },
        tripUpdateStopIdsInStatic: { total: stopRefs, matched: stopMatch },
        vehicleTripIdsInStatic: { total: vehTrip.length, matched: vehMatch },
        routeIdsInFeedNotInStatic: unknownRouteIds,
      },
      lines: perLine,
      note: 'Valori a zero possono significare linea senza corse in servizio in questo momento: ripeti la misura in orari diversi prima di concludere che una linea non è coperta.',
    });
  });
}
