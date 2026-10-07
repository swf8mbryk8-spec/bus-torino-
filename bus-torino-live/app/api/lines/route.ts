import { guard, json } from '@/lib/http';
import { dataAvailable, routes, routesByShort } from '@/lib/data';
import { feedAge, getAlerts, getVehicles } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

/**
 * Senza parametri: elenco completo delle linee del GTFS statico.
 * Con ?lines=18,55: stato di ciascuna linea (esiste? quanti mezzi con GPS? avvisi attivi?).
 */
export function GET(req: Request) {
  return guard(req, async () => {
    if (!dataAvailable()) return json({ error: 'Dati GTFS non ancora generati.' }, { status: 503 });
    const q = new URL(req.url).searchParams.get('lines');
    if (!q) {
      const seen = new Set<string>();
      const all = routes().filter((r) => { const k = r.s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .map((r) => ({ line: r.s, name: r.l }));
      return json({ lines: all }, { cache: 'public, s-maxage=3600' });
    }
    const wanted = q.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30);
    const [v, a] = await Promise.all([getVehicles(), getAlerts()]);
    const now = Date.now();
    return json({
      lines: wanted.map((l) => {
        const ids = new Set(routesByShort(l).map((r) => r.id));
        return {
          line: l,
          exists: ids.size > 0,
          vehicles: v.state.fetchedAt ? v.vehicles.filter((x) => x.routeId && ids.has(x.routeId)).length : null,
          alerts: a.state.fetchedAt ? a.alerts.filter((x) => x.routeIds.some((r) => ids.has(r))).length : null,
        };
      }),
      status: { vehiclesOk: v.state.ok, vehiclesAgeMs: feedAge(v.state, now), alertsOk: a.state.ok },
      generatedAt: now,
    });
  });
}
