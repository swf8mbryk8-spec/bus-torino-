'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ago, usePoll, useNow, useLocalList } from '@/lib/client';
import type { AlertItem, VehiclePos } from '@/lib/types';
import { AlertList, LineBadge, Notice, ShareButton } from './Bits';
import MapClient from './MapClient';

type St = { id: string; code: string; name: string; lat: number; lon: number };
type Resp = {
  line: string; routes: { id: string; name: string }[];
  directions: { routeId: string; dir: number; head: string; stops: St[]; shape: [number, number][] }[];
  vehicles: VehiclePos[]; alerts: AlertItem[]; generatedAt: number;
  vehiclesStatus: { ok: boolean; ageMs: number | null; error: string | null; fetchedAt: number | null };
};

export default function LineView({ id }: { id: string }) {
  const { data, error, reload, skew } = usePoll<Resp>(`/api/line/${encodeURIComponent(id)}`, 20000);
  const now = useNow(skew, 5000);
  const [sel, setSel] = useState(0);
  const [filter, setFilter] = useState('');
  const fav = useLocalList<string>('btl:lines', ['45', '81', '43']);

  const dir = data?.directions[sel] ?? data?.directions[0];
  const shown = useMemo(() => {
    if (!dir) return [];
    const f = filter.trim().toLowerCase();
    return f ? dir.stops.filter((s) => s.name.toLowerCase().includes(f) || s.code === f) : dir.stops;
  }, [dir, filter]);
  const shapes = useMemo(() => (dir ? [dir.shape] : []), [dir]);
  const mapStops = useMemo(() => (dir ? dir.stops : []), [dir]);

  if (!data && error) return <Notice kind="error">{error} <button className="btn" onClick={reload}>Riprova</button></Notice>;
  if (!data) return <p className="muted">Carico la linea…</p>;
  const isFav = fav.list.map((x) => x.toLowerCase()).includes(data.line.toLowerCase());
  const vAge = data.vehiclesStatus.ageMs !== null ? data.vehiclesStatus.ageMs + (now - data.generatedAt) : null;

  return (
    <>
      <header className="stop-head">
        <h1><LineBadge line={data.line} /> {data.routes[0]?.name}</h1>
        <div className="actions">
          <ShareButton path={`/line/${encodeURIComponent(data.line)}`} title={`Linea ${data.line}`} />
          <button className={`btn ${isFav ? 'on' : ''}`} type="button" aria-pressed={isFav}
            onClick={() => fav.save(isFav ? fav.list.filter((x) => x.toLowerCase() !== data.line.toLowerCase()) : [...fav.list, data.line])}>
            {isFav ? '★ Nelle mie linee' : '☆ Aggiungi alle mie linee'}
          </button>
        </div>
      </header>

      <AlertList alerts={data.alerts} />
      {!data.vehiclesStatus.ok && <Notice kind="warn">Posizione dei mezzi non disponibile{data.vehiclesStatus.error ? ` (${data.vehiclesStatus.error})` : ''}.</Notice>}
      {error && <Notice kind="warn">Aggiornamento non riuscito: {error}</Notice>}

      <p className="muted">
        {data.vehicles.length > 0
          ? `${data.vehicles.length} ${data.vehicles.length === 1 ? 'mezzo' : 'mezzi'} con posizione GPS nel feed GTT · dato di ${ago(vAge)}`
          : 'Nessun mezzo di questa linea nel feed GPS in questo momento (può non essere in servizio, o non essere coperta dal feed).'}
      </p>

      {data.directions.length > 1 && (
        <div className="tabs" role="tablist">
          {data.directions.map((d, i) => (
            <button key={d.routeId + d.dir} role="tab" aria-selected={i === sel} className={i === sel ? 'on' : ''} onClick={() => setSel(i)}>
              {d.head ? `Verso ${d.head}` : `Direzione ${d.dir}`}
            </button>
          ))}
        </div>
      )}

      <MapClient stops={mapStops} shapes={shapes} vehicles={data.vehicles} nowFn={() => now} height="40vh" />

      {data.vehicles.length > 0 && (
        <ul className="plain">
          {data.vehicles.map((v) => (
            <li key={v.id}>Mezzo {v.label || v.id}{v.headsign ? ` → ${v.headsign}` : ''} · {v.timestamp ? `posizione di ${ago(now - v.timestamp)}` : 'orario posizione non indicato'}</li>
          ))}
        </ul>
      )}

      <h2>Fermate{dir?.head ? ` verso ${dir.head}` : ''}</h2>
      <label className="sr-only" htmlFor="f">Filtra le fermate</label>
      <input id="f" className="filter" type="search" placeholder="Filtra le fermate (es. nome di un comune o di una via)" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ol className="stoplist">
        {shown.map((s) => (
          <li key={s.id}><Link href={`/stop/${encodeURIComponent(s.id)}`}>{s.name}<span className="muted"> {s.code && `· ${s.code}`}</span></Link></li>
        ))}
        {shown.length === 0 && <li className="muted">Nessuna fermata corrisponde al filtro.</li>}
      </ol>
    </>
  );
}
