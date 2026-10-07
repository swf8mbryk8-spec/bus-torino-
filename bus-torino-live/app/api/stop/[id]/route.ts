import { guard, json } from '@/lib/http';
import { dataAvailable, stopById, routes } from '@/lib/data';
import { stopArrivals } from '@/lib/arrivals';
import { getAlerts } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guard(req, async () => {
    if (!dataAvailable()) return json({ error: 'Dati GTFS non ancora generati.' }, { status: 503 });
    const { id } = await ctx.params;
    const stop = stopById(decodeURIComponent(id));
    if (!stop) return json({ error: 'Fermata non trovata.' }, { status: 404 });
    const [arr, al] = await Promise.all([stopArrivals(stop.i), getAlerts()]);
    const shorts = new Set(stop.r);
    const rids = new Set(routes().filter((r) => shorts.has(r.s)).map((r) => r.id));
    const alerts = al.alerts.filter((a) => a.stopIds.includes(stop.i) || a.routeIds.some((r) => rids.has(r)));
    return json({
      stop: { id: stop.i, code: stop.c, name: stop.n, desc: stop.d, lat: stop.la, lon: stop.lo, lines: stop.r },
      ...arr,
      alerts,
      alertsStatus: { ok: al.state.ok, fetchedAt: al.state.fetchedAt, error: al.state.error },
    });
  });
}
