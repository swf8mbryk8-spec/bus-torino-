'use client';
import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ago, clock, dot, usePoll, useNow } from '@/lib/client';
import { phase } from '@/lib/countdown';
import { estimate } from '@/lib/estimate';
import { getHistory, recordSnapshot, rememberStopName } from '@/lib/history';
import type { Arrival, AlertItem } from '@/lib/types';
import { AlertList, LineBadge, Notice, ShareButton } from './Bits';
import SaveStop from './SaveStop';
import MapClient from './MapClient';

type Rt = { ok: boolean; fetchedAt: number | null; headerTs: number | null; ageMs: number | null; error: string | null };
type Resp = {
  stop: { id: string; code: string; name: string; desc: string; lat: number; lon: number; lines: string[] };
  arrivals: Arrival[]; generatedAt: number; sources: string[]; alerts: AlertItem[];
  realtime: { tripUpdates: Rt; vehicles: Rt; available: boolean };
};

const RELI = { high: 'Alta affidabilità', medium: 'Affidabilità media', low: 'Bassa affidabilità' } as const;
const lower = (c: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' => (c === 'high' ? 'medium' : 'low');

export function ArrivalRow({ a, now, stopId, rtDown }: { a: Arrival; now: number; stopId: string; rtDown?: boolean }) {
  const ph = phase(a, now);
  const realtime = a.tier === 'live' || a.tier === 'prevision' || a.tier === 'stale';
  const delayMin = a.delaySec !== null ? Math.round(a.delaySec / 60) : null;
  const est = useMemo(
    () => (a.scheduled !== null && (a.tier === 'scheduled' || realtime) ? estimate(getHistory(), { stop: stopId, line: a.line, head: a.headsign, scheduled: a.scheduled }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.tripId, a.scheduled, a.tier, stopId, Math.floor(now / 60000)],
  );
  // Realtime + storico: se la previsione GTT si discosta molto dallo storico locale, l'affidabilità scende di un livello.
  const diverges = realtime && a.confidence !== null && est !== null && est.ok && est.n >= 5 && a.delaySec !== null && Math.abs(a.delaySec - est.delaySec) > 300;
  const conf = a.confidence ? (diverges ? lower(a.confidence) : a.confidence) : null;
  const d = dot(a, conf);
  const showEst = est && est.ok && a.tier === 'scheduled';
  const estMins = showEst ? Math.round((est.time - now) / 60000) : null;
  if (ph.kind === 'passed') return null;

  return (
    <li className={`arr ${d.cls}`}>
      <LineBadge line={a.line} />
      <div className="arr-main">
        <div className="head">{d.icon} Linea {a.line} → {a.headsign || 'direzione non indicata'}</div>
        <div className="arr-status">
          {ph.kind === 'arrived' && <span className="big">Alla fermata</span>}
          {ph.kind === 'imminent' && <span className="big">In arrivo</span>}
          {ph.kind === 'minutes' && <span className="big">{ph.mins} <span className="unit">min</span></span>}
          {ph.kind === 'clock' && <span className="big clock">{clock(a.time)}</span>}
          {ph.kind === 'none' && <span className="big small">—</span>}
        </div>
        {realtime && ph.kind !== 'none' && (
          <div>
            {a.tier === 'stale' ? 'Ultima previsione' : 'Arrivo stimato'}: <strong>{clock(a.time)}</strong>
            {a.scheduled && delayMin !== null && <span className="muted"> · {delayMin === 0 ? 'in orario' : delayMin > 0 ? `+${delayMin} min di ritardo` : `${-delayMin} min in anticipo`} (programmato {clock(a.scheduled)})</span>}
          </div>
        )}
        {a.tier === 'scheduled' && <div><strong>⚪ Orario programmato</strong><span className="muted"> · {rtDown ? 'nessun dato realtime disponibile' : (a.note || 'nessuna previsione realtime')}</span></div>}
        {a.tier === 'unavailable' && <div><strong>🔴 {a.note || 'Non disponibile'}</strong></div>}
        {realtime && a.distanceM !== null && (
          <div>📍 {a.distanceM >= 1000 ? `${(a.distanceM / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(a.distanceM / 10) * 10} m`} dalla fermata (in linea d'aria)
            {a.approaching === true && ' · si avvicina'}{a.approaching === false && ' · si allontana'}
            {a.moving === true && ' · in movimento'}{a.moving === false && ' · fermo'}
            {a.gpsAgeMs !== null && <span className="muted"> · GPS di {ago(a.gpsAgeMs)}</span>}
          </div>
        )}
        {realtime && a.distanceM === null && a.tier !== 'stale' && <div className="muted">Posizione del mezzo non disponibile: solo previsione GTT</div>}
        {realtime && conf && (
          <details className="why">
            <summary><strong>{RELI[conf]}</strong>{a.tier === 'stale' && ' · dati realtime non aggiornati'}{a.tier === 'live' ? ' · realtime GPS' : a.tier === 'prevision' ? ' · previsione GTT' : ''}</summary>
            <ul className="plain tight">
              {a.why.map((w) => <li key={w}>{w}</li>)}
              {diverges && est && est.ok && <li>la previsione GTT differisce di oltre 5 min dal tuo storico ({est.n} passaggi, ritardo tipico {Math.round(est.delaySec / 60)} min)</li>}
            </ul>
          </details>
        )}
        {a.tier === 'stale' && a.dataTimestamp && <div className="warn-line">🟠 Dati realtime non aggiornati · ultimo dato {ago(now - a.dataTimestamp)}</div>}
        <div className="muted">Fonte: {realtime || a.tier === 'unavailable' ? 'GTT GTFS-RT' : 'orari programmati GTT'}</div>
        {showEst && est && est.ok && (
          <div className="est">
            <strong>🟡 Stima dallo storico: {clock(est.time)}{estMins !== null && estMins > 0 ? ` · ≈ ${estMins} min` : ''}</strong>
            <span className="block">{RELI[est.reliability === 'low' ? 'low' : est.reliability]}{est.reliability === 'low' ? ' (dati insufficienti)' : ''} · basata su {est.n} {est.n === 1 ? 'passaggio osservato' : 'passaggi osservati'} ({est.scope}, ±{est.windowMin} min, {est.days} {est.days === 1 ? 'giorno' : 'giorni'}).{rtDown ? ' Realtime non disponibile.' : ''}</span>
            <span className="block muted">Ritardo tipico {Math.round(est.delaySec / 60) >= 0 ? '+' : ''}{Math.round(est.delaySec / 60)} min. Non è un dato ufficiale.</span>
          </div>
        )}
        {a.tier === 'scheduled' && est && !est.ok && <div className="est weak"><span>🔴 Dati insufficienti per una stima dallo storico.</span> <span className="muted">{est.reason}</span></div>}
      </div>
    </li>
  );
}

export default function StopView({ id }: { id: string }) {
  const { data, error, loadedAt, loading, reload, skew } = usePoll<Resp>(`/api/stop/${encodeURIComponent(id)}`, 20000);
  const now = useNow(skew, 5000);
  const stops = useMemo(() => (data ? [{ id: data.stop.id, name: data.stop.name, code: data.stop.code, lat: data.stop.lat, lon: data.stop.lon }] : []), [data]);

  // Registra nello storico locale i passaggi osservati (solo con realtime disponibile).
  useEffect(() => {
    if (!data || !data.realtime.available) return;
    rememberStopName(data.stop.id, data.stop.name);
    recordSnapshot(data.stop.id, data.arrivals, data.generatedAt);
  }, [data]);

  if (!data && error) return <Notice kind="error">{error} <button className="btn" onClick={reload}>Riprova</button></Notice>;
  if (!data) return <p className="muted">Carico la fermata…</p>;
  const { stop, arrivals, realtime } = data;
  const rtAge = realtime.tripUpdates.ageMs !== null ? realtime.tripUpdates.ageMs + (now - data.generatedAt) : null;

  return (
    <>
      <header className="stop-head">
        <p className="muted">Fermata</p>
        <h1>{stop.name}</h1>
        <p className="muted">Indirizzo/zona: {stop.desc || 'non indicato nei dati GTT'} · Codice: {stop.code || 'non disponibile'}</p>
        <div className="mini-lines">{stop.lines.map((l) => <Link key={l} href={`/line/${encodeURIComponent(l)}`}><LineBadge line={l} /></Link>)}</div>
        <div className="actions">
          <ShareButton path={`/stop/${encodeURIComponent(stop.id)}`} title={`Fermata ${stop.name}`} />
          <SaveStop stop={{ id: stop.id, name: stop.name, code: stop.code, lines: stop.lines }} />
        </div>
      </header>

      {!realtime.available && <Notice kind="warn"><strong>Dati realtime temporaneamente non disponibili.</strong> Sono mostrati solo gli orari programmati{realtime.tripUpdates.error ? ` (errore fonte: ${realtime.tripUpdates.error})` : ''}. Lo storico non viene aggiornato.</Notice>}
      {realtime.available && realtime.tripUpdates.ok && rtAge !== null && rtAge > 120_000 && <Notice kind="warn">🟠 Dati realtime non aggiornati: ultimo aggiornamento {ago(rtAge)}. L'affidabilità mostrata è ridotta.</Notice>}
      {realtime.available && !realtime.tripUpdates.ok && <Notice kind="warn">Fonte temporaneamente non disponibile. I dati realtime mostrati risalgono a {ago(rtAge)} e sono segnalati come datati.</Notice>}
      <AlertList alerts={data.alerts} />
      {error && <Notice kind="warn">Aggiornamento non riuscito: {error}</Notice>}

      <h2>Prossimi passaggi</h2>
      {arrivals.length === 0
        ? <p className="muted">Nessun passaggio nelle prossime 3 ore secondo i dati disponibili.</p>
        : <ul className="arrivals">{arrivals.map((a) => <ArrivalRow key={a.tripId + a.time} a={a} now={now} stopId={stop.id} rtDown={!realtime.available} />)}</ul>}
      <p className="muted">Colore = affidabilità dei dati: 🟢 alta · 🟡 media (o stima dallo storico) · 🔴 bassa · 🟠 dato realtime datato · ⚪ solo orario programmato. <Link href="/storico">Come funzionano le stime</Link></p>

      <footer className="foot">
        <p>Fonti utilizzate: {data.sources.join(', ')}</p>
        <p>
          Dato realtime GTT: {realtime.available ? ago(rtAge) : 'non disponibile'} · aggiornamento automatico ogni 20 secondi
          {' '}<button className="link" onClick={reload} disabled={loading}>{loading ? 'aggiorno…' : 'Aggiorna ora'}</button>
          {loadedAt ? '' : ''}
        </p>
      </footer>
      <MapClient stops={stops} height="260px" />
    </>
  );
}
