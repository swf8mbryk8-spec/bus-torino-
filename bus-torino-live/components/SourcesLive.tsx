'use client';
import { useEffect, useState } from 'react';

export default function SourcesLive() {
  const [m, setM] = useState<{ dataAvailable: boolean; meta: { generatedAt: string; counts: { routes: number; stops: number; trips: number }; serviceRange: { from: string; to: string } } | null } | null>(null);
  useEffect(() => { fetch('/api/meta').then((r) => r.json()).then(setM).catch(() => setM(null)); }, []);
  if (!m) return null;
  if (!m.meta) return <p className="muted">Dati GTFS non ancora generati su questo server.</p>;
  const f = (d: string) => `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
  return (
    <p className="muted">
      Dati statici generati il {new Date(m.meta.generatedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}: {m.meta.counts.routes} linee, {m.meta.counts.stops} fermate, {m.meta.counts.trips} corse. Calendario coperto: dal {f(m.meta.serviceRange.from)} al {f(m.meta.serviceRange.to)}.
    </p>
  );
}
