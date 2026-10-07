import { guard, json } from '@/lib/http';
import { dataAvailable, meta } from '@/lib/data';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return guard(req, () => json({ dataAvailable: dataAvailable(), meta: meta() }, { cache: 'public, s-maxage=600' }));
}
