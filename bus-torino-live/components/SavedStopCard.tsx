'use client';
import Link from 'next/link';
import { clock, dot, usePoll, useNow } from '@/lib/client';
import { phase } from '@/lib/countdown';
import type { Arrival } from '@/lib/types';
import { LineBadge } from './Bits';
import type { SavedStop } from './SaveStop';

type Resp = { arrivals: Arrival[]; generatedAt: number; realtime: { available: boolean } };

export default function SavedStopCard({ s }: { s: SavedStop }) {
  const { data, error, skew } = usePoll<Resp>(`/api/stop/${encodeURIComponent(s.id)}`, 30000);
  const now = useNow(skew, 10000);
  const next = data?.arrivals.slice(0, 3) ?? [];
  return (
    <li className="saved-card">
      <Link href={`/stop/${encodeURIComponent(s.id)}`} className="saved-head">
        <strong>⭐ {s.label || s.name}</strong>
        {s.label && <span className="muted block">{s.name}{s.code ? ` · ${s.code}` : ''}</span>}
      </Link>
      {s.lines && s.lines.length > 0 && <div className="mini-lines">{s.lines.slice(0, 10).map((l) => <LineBadge key={l} line={l} />)}</div>}
      {error && <p className="muted">Dati non disponibili ora: {error}</p>}
      {data && next.length === 0 && <p className="muted">Nessun passaggio nelle prossime 3 ore.</p>}
      {data && !data.realtime.available && next.length > 0 && <p className="muted">Realtime non disponibile: solo orari programmati.</p>}
      <ul className="plain tight">
        {next.map((a) => {
          const ph = phase(a, now);
          if (ph.kind === 'passed') return null;
          const txt = ph.kind === 'arrived' ? 'alla fermata' : ph.kind === 'imminent' ? 'in arrivo' : ph.kind === 'minutes' ? `${ph.mins} min` : 'programmato';
          return (
            <li key={a.tripId + a.time}>
              <span aria-hidden>{dot(a).icon}</span> <strong>{a.line}</strong> {clock(a.time)}
              <span className="muted"> · {txt}{a.headsign ? ` · ${a.headsign}` : ''}</span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
