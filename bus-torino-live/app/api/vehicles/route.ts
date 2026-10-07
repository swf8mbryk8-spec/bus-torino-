import { guard, json } from '@/lib/http';
import { dataAvailable, routesByShort } from '@/lib/data';
import { feedAge, getVehicles } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return guard(req, async () => {
    if (!dataAvailable()) return json({ error: 'Dati GTFS non ancora generati.' }, { status: 503 });
    const sp = new URL(req.url).searchParams;
    const line = sp.get('line');
    const bbox = sp.get('bbox')?.split(',').map(Number); // sud,ovest,nord,est
    const { state, vehicles } = await getVehicles();
    let list = vehicles;
    const wanted = (line || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);
    if (wanted.length) { const ids = new Set(wanted.flatMap((l) => routesByShort(l).map((r) => r.id))); list = list.filter((v) => v.routeId && ids.has(v.routeId)); }
    if (bbox && bbox.length === 4 && bbox.every(Number.isFinite)) {
      const [s, w, n, e] = bbox;
      list = list.filter((v) => v.lat >= s && v.lat <= n && v.lon >= w && v.lon <= e);
    }
    const now = Date.now();
    return json({
      vehicles: list.slice(0, 1500),
      total: vehicles.length,
      status: { ok: state.ok, fetchedAt: state.fetchedAt, headerTs: state.headerTs, ageMs: feedAge(state, now), error: state.error },
      generatedAt: now,
    });
  });
}
