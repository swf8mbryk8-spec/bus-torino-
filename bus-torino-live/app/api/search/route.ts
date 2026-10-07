import { guard, json } from '@/lib/http';
import { dataAvailable } from '@/lib/data';
import { search } from '@/lib/search';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return guard(req, () => {
    if (!dataAvailable()) return json({ error: 'Dati GTFS non ancora generati (esegui npm run data).' }, { status: 503 });
    const q = new URL(req.url).searchParams.get('q') || '';
    return json({ q, results: search(q.slice(0, 80)) }, { cache: 'public, s-maxage=300' });
  });
}
