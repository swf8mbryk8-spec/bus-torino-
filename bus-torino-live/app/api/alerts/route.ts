import { guard, json } from '@/lib/http';
import { getAlerts } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return guard(req, async () => {
    const { state, alerts } = await getAlerts();
    return json({ alerts, status: { ok: state.ok, fetchedAt: state.fetchedAt, error: state.error }, generatedAt: Date.now() });
  });
}
