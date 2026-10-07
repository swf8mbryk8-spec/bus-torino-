import { guard, json } from '@/lib/http';
import { dataAvailable, routeDetail, routesByShort, routeById, stopById } from '@/lib/data';
import { getAlerts, getVehicles, feedAge } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guard(req, async () => {
    if (!dataAvailable()) return json({ error: 'Dati GTFS non ancora generati.' }, { status: 503 });
    const { id } = await ctx.params;
    const key = decodeURIComponent(id);
    let rs = routesByShort(key);
    if (!rs.length) { const r = routeById(key); if (r) rs = [r]; }
    if (!rs.length) return json({ error: 'Linea non trovata.' }, { status: 404 });
    const ids = new Set(rs.map((r) => r.id));
    const directions = rs.flatMap((r) =>
      (routeDetail(r.id)?.directions || []).map((d) => ({
        routeId: r.id, dir: d.dir, head: d.head,
        stops: d.stops.map((sid) => { const s = stopById(sid); return s ? { id: s.i, code: s.c, name: s.n, lat: s.la, lon: s.lo } : null; }).filter(Boolean),
        shape: d.shape,
      })),
    );
    const [v, al] = await Promise.all([getVehicles(), getAlerts()]);
    const now = Date.now();
    return json({
      line: rs[0].s,
      routes: rs.map((r) => ({ id: r.id, name: r.l, type: r.t })),
      directions,
      vehicles: v.vehicles.filter((x) => x.routeId && ids.has(x.routeId)),
      vehiclesStatus: { ok: v.state.ok, fetchedAt: v.state.fetchedAt, headerTs: v.state.headerTs, ageMs: feedAge(v.state, now), error: v.state.error },
      alerts: al.alerts.filter((a) => a.routeIds.some((r) => ids.has(r))),
      generatedAt: now,
    });
  });
}
