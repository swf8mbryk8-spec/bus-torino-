'use client';
import { useState } from 'react';
import { ago, usePoll, useNow } from '@/lib/client';
import type { VehiclePos } from '@/lib/types';
import { Notice } from './Bits';
import MapClient from './MapClient';

type Resp = { vehicles: VehiclePos[]; total: number; generatedAt: number; status: { ok: boolean; ageMs: number | null; error: string | null } };

export default function LiveMap({ initialLine = '' }: { initialLine?: string }) {
  const [line, setLine] = useState(initialLine);
  const [bbox, setBbox] = useState('');
  const qs = new URLSearchParams();
  if (line.trim()) qs.set('line', line.trim());
  if (bbox) qs.set('bbox', bbox);
  const { data, error, skew } = usePoll<Resp>(`/api/vehicles?${qs}`, 20000);
  const now = useNow(skew, 5000);
  const age = data && data.status.ageMs !== null ? data.status.ageMs + (now - data.generatedAt) : null;
  return (
    <>
      <label className="sr-only" htmlFor="ln">Filtra per linea</label>
      <input id="ln" className="filter" type="search" placeholder="Una o più linee separate da virgola (es. 18,55)" value={line} onChange={(e) => setLine(e.target.value)} />
      {error && <Notice kind="warn">{error}</Notice>}
      {data && !data.status.ok && <Notice kind="warn">Fonte posizioni temporaneamente non disponibile{data.status.error ? ` (${data.status.error})` : ''}. I mezzi mostrati, se presenti, sono datati.</Notice>}
      <MapClient vehicles={data?.vehicles || []} nowFn={() => now} height="68vh" fit={false} onBounds={setBbox} />
      <p className="muted">{data ? `${data.vehicles.length} mezzi in vista (${data.total} nel feed) · dato GTT di ${ago(age)}` : 'Carico i mezzi…'}</p>
    </>
  );
}
