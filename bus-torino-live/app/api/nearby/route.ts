import { guard, json } from '@/lib/http';
import { dataAvailable, stops } from '@/lib/data';
import { stopArrivals } from '@/lib/arrivals';

export const dynamic = 'force-dynamic';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
function dist(a1: number, o1: number, a2: number, o2: number) {
  const dLa = rad(a2 - a1), dLo = rad(o2 - o1);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// La posizione arriva solo come parametro della richiesta: non viene salvata né registrata.
export function GET(req: Request) {
  return guard(req, async () => {
    if (!dataAvailable()) return json({ error: 'Dati GTFS non ancora generati.' }, { status: 503 });
    const sp = new URL(req.url).searchParams;
    const lat = Number(sp.get('lat')), lon = Number(sp.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
      return json({ error: 'Coordinate non valide.' }, { status: 400 });
    const near = stops()
      .map((s) => ({ s, m: dist(lat, lon, s.la, s.lo) }))
      .filter((x) => x.m <= 1500)
      .sort((a, b) => a.m - b.m)
      .slice(0, 10);
    const withArr = await Promise.all(
      near.slice(0, 5).map(async (x) => ({ id: x.s.i, arrivals: (await stopArrivals(x.s.i, Date.now(), 4)).arrivals })),
    );
    const arrMap = new Map(withArr.map((x) => [x.id, x.arrivals]));
    return json({
      stops: near.map((x) => ({
        id: x.s.i, code: x.s.c, name: x.s.n, desc: x.s.d, lat: x.s.la, lon: x.s.lo, lines: x.s.r.slice(0, 12),
        meters: Math.round(x.m), arrivals: arrMap.get(x.s.i) ?? null,
      })),
      generatedAt: Date.now(),
    });
  });
}
