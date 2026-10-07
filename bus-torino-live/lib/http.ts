import { NextResponse } from 'next/server';

const buckets = new Map<string, { n: number; reset: number }>();
const LIMIT = 120; // richieste al minuto per IP (best effort: in serverless vale per istanza)

export function limited(req: Request): boolean {
  const ip = (req.headers.get('x-forwarded-for') || 'anon').split(',')[0].trim();
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) { buckets.set(ip, { n: 1, reset: now + 60_000 }); }
  else if (++b.n > LIMIT) return true;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return false;
}

export function json(data: unknown, init?: { status?: number; cache?: string }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { 'Cache-Control': init?.cache ?? 'no-store' },
  });
}

export async function guard(req: Request, fn: () => Promise<Response> | Response): Promise<Response> {
  if (limited(req)) return json({ error: 'Troppe richieste, riprova tra poco.' }, { status: 429 });
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    return json({ error: 'Errore interno. Riprova tra poco.' }, { status: 500 });
  }
}
