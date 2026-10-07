'use client';
import { useState } from 'react';
import { ago } from '@/lib/client';
import { Notice } from './Bits';

type D = {
  generatedAt: number;
  feeds: Record<string, { ok: boolean; entities: number; ageMs: number | null; error: string | null }>;
  idMatching: { tripUpdateTripIdsInStatic: { total: number; matched: number }; tripUpdateStopIdsInStatic: { total: number; matched: number }; vehicleTripIdsInStatic: { total: number; matched: number }; routeIdsInFeedNotInStatic: number };
  lines: { line: string; inStaticGtfs: boolean; routeIds: string[]; tripUpdatesInFeed: number; vehiclesInFeed: number }[];
  note: string;
};
const pct = (x: { total: number; matched: number }) => (x.total ? `${x.matched}/${x.total} (${((100 * x.matched) / x.total).toFixed(1)}%)` : 'nessun dato nel feed');

export default function Diag() {
  const [lines, setLines] = useState('45,81,43');
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/diagnostics?lines=' + encodeURIComponent(lines));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Errore');
      setD(j);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <>
      <p>Misura sul feed reale GTT quali linee hanno dati realtime, quanto sono recenti e se gli identificativi del realtime corrispondono al GTFS statico.</p>
      <label htmlFor="dl">Linee da controllare (separate da virgola)</label>
      <input id="dl" className="filter" value={lines} onChange={(e) => setLines(e.target.value)} />
      <button className="btn primary" onClick={run} disabled={busy} type="button">{busy ? 'Misuro…' : 'Esegui la misura'}</button>
      {err && <Notice kind="error">{err}</Notice>}
      {d && (
        <>
          <h2>Feed</h2>
          <ul className="plain">
            {Object.entries(d.feeds).map(([k, f]) => (
              <li key={k}><strong>{k}</strong>: {f.ok ? 'raggiungibile' : 'NON raggiungibile'} · {f.entities} elementi · dato di {ago(f.ageMs)}{f.error ? ` · errore: ${f.error}` : ''}</li>
            ))}
          </ul>
          <h2>Corrispondenza identificativi statico/realtime</h2>
          <ul className="plain">
            <li>trip_id delle previsioni presenti nel GTFS statico: {pct(d.idMatching.tripUpdateTripIdsInStatic)}</li>
            <li>stop_id delle previsioni presenti nel GTFS statico: {pct(d.idMatching.tripUpdateStopIdsInStatic)}</li>
            <li>trip_id dei veicoli presenti nel GTFS statico: {pct(d.idMatching.vehicleTripIdsInStatic)}</li>
            <li>route_id del feed non presenti nel GTFS statico: {d.idMatching.routeIdsInFeedNotInStatic}</li>
          </ul>
          <h2>Linee</h2>
          <ul className="plain">
            {d.lines.map((l) => (
              <li key={l.line}><strong>{l.line}</strong>: {l.inStaticGtfs ? 'presente nel GTFS statico' : 'NON presente nel GTFS statico'} · previsioni nel feed: {l.tripUpdatesInFeed} · mezzi con GPS: {l.vehiclesInFeed}</li>
            ))}
          </ul>
          <p className="muted">{d.note}</p>
        </>
      )}
    </>
  );
}
