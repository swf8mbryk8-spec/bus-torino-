'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ago, usePoll, useNow } from '@/lib/client';
import type { Arrival } from '@/lib/types';
import { LineBadge, Notice } from './Bits';
import { ArrivalRow } from './StopView';
import MapClient from './MapClient';

type Resp = { stops: { id: string; code: string; name: string; desc: string; lat: number; lon: number; lines: string[]; meters: number; arrivals: Arrival[] | null }[]; generatedAt: number };

export default function NearbyView() {
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // La posizione resta solo in memoria di questa pagina: non viene salvata né registrata.
  const url = pos ? `/api/nearby?lat=${pos.lat.toFixed(5)}&lon=${pos.lon.toFixed(5)}` : null;
  const { data, error, skew } = usePoll<Resp>(url, 30000);
  const now = useNow(skew, 5000);
  useEffect(() => { if (data) setErr(null); }, [data]);

  function ask() {
    if (!navigator.geolocation) { setErr('Questo dispositivo non supporta la geolocalizzazione.'); return; }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setAsking(false); setPos({ lat: p.coords.latitude, lon: p.coords.longitude }); },
      (e) => { setAsking(false); setErr(e.code === 1 ? 'Permesso di posizione negato. Puoi cercare una fermata per nome.' : 'Impossibile ottenere la posizione.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  return (
    <>
      {!pos && (
        <>
          <p>La posizione viene usata solo per cercare le fermate vicine e non viene salvata.</p>
          <button className="btn primary" onClick={ask} disabled={asking} type="button">{asking ? 'Cerco la posizione…' : '📍 Usa la mia posizione'}</button>
        </>
      )}
      {err && <Notice kind="error">{err}</Notice>}
      {error && <Notice kind="warn">{error}</Notice>}
      {data && data.stops.length === 0 && <p className="muted">Nessuna fermata entro 1,5 km dalla tua posizione nei dati disponibili.</p>}
      {data && data.stops.length > 0 && (
        <>
          <MapClient me={pos} stops={data.stops} height="30vh" />
          <ul className="nearby">
            {data.stops.map((s) => (
              <li key={s.id}>
                <Link href={`/stop/${encodeURIComponent(s.id)}`} className="near-head">
                  <strong>{s.name}</strong><span className="muted"> · {s.meters} m{s.code && ` · codice ${s.code}`}</span>
                </Link>
                <div className="mini-lines">{s.lines.map((l) => <LineBadge key={l} line={l} />)}</div>
                {s.arrivals && s.arrivals.length > 0 && <ul className="arrivals compact">{s.arrivals.map((a) => <ArrivalRow key={a.tripId + a.time} a={a} now={now} stopId={s.id} />)}</ul>}
                {s.arrivals && s.arrivals.length === 0 && <p className="muted">Nessun passaggio nelle prossime 3 ore.</p>}
              </li>
            ))}
          </ul>
          <p className="muted">Aggiornato {ago(now - data.generatedAt)}</p>
        </>
      )}
    </>
  );
}
