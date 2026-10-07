'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useLocalList, usePoll } from '@/lib/client';
import { LineBadge, ShareButton } from './Bits';
import SearchBox from './SearchBox';
import SavedStopCard from './SavedStopCard';
import type { SavedStop } from './SaveStop';

type LineStatus = { lines: { line: string; exists: boolean; vehicles: number | null; alerts: number | null }[] };

export default function Home() {
  // 45, 81 e 43 sono solo il valore iniziale: ogni linea dei dati GTT può essere aggiunta, tolta o riordinata.
  const lines = useLocalList<string>('btl:lines', ['45', '81', '43']);
  const stops = useLocalList<SavedStop>('btl:stops', []);
  const [edit, setEdit] = useState(false);
  const status = usePoll<LineStatus>(lines.list.length ? `/api/lines?lines=${encodeURIComponent(lines.list.join(','))}` : null, 30000);
  const st = new Map((status.data?.lines ?? []).map((x) => [x.line.toLowerCase(), x]));

  const add = (l: string) => { if (!lines.list.some((x) => x.toLowerCase() === l.toLowerCase())) lines.save([...lines.list, l]); };
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= lines.list.length) return;
    const n = [...lines.list]; [n[i], n[j]] = [n[j], n[i]]; lines.save(n);
  };

  return (
    <>
      <SearchBox />

      <section>
        <div className="sec-head">
          <h2>⭐ Le mie linee</h2>
          <button className="btn ghost" onClick={() => setEdit(!edit)} type="button">{edit ? 'Fatto' : 'Modifica'}</button>
        </div>
        {lines.list.length === 0 && <p className="muted">Nessuna linea salvata. Cercane una qui sotto e aggiungila.</p>}
        <ul className="my-lines">
          {lines.list.map((l, i) => {
            const s = st.get(l.toLowerCase());
            return (
              <li key={l}>
                <Link href={`/line/${encodeURIComponent(l)}`} className="big-line">
                  <span aria-hidden>🚌</span> <LineBadge line={l} />
                  <span className="muted line-st">
                    {s && !s.exists ? 'non trovata' : s?.vehicles != null ? `${s.vehicles} ${s.vehicles === 1 ? 'mezzo' : 'mezzi'} GPS` : ''}
                    {s?.alerts ? ` · ⚠ ${s.alerts}` : ''}
                  </span>
                </Link>
                {edit && (
                  <span className="edit">
                    <button className="btn ghost" onClick={() => move(i, -1)} aria-label={`Sposta ${l} su`} type="button">↑</button>
                    <button className="btn ghost" onClick={() => move(i, 1)} aria-label={`Sposta ${l} giù`} type="button">↓</button>
                    <button className="btn ghost" onClick={() => lines.save(lines.list.filter((x) => x !== l))} aria-label={`Rimuovi ${l}`} type="button">✕</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted">Aggiungi una linea (qualsiasi, anche per destinazione):</p>
        <SearchBox placeholder="Es. 18, 55, 68…" onPickLine={add} />
        <p>
          <Link href="/lines">Tutte le linee</Link>
          {lines.list.length > 0 && <> · <Link href={`/map?line=${encodeURIComponent(lines.list.join(','))}`}>Mappa delle mie linee</Link></>}
        </p>
      </section>

      <section>
        <h2>⭐ Le mie fermate</h2>
        {stops.list.length === 0
          ? <p className="muted">Cerca una fermata, aprila e premi “Salva fermata” per darle un nome (Casa, Lavoro…).</p>
          : <ul className="saved-list">{stops.list.slice(0, 6).map((s) => <SavedStopCard key={s.id} s={s} />)}</ul>}
        {stops.list.length > 6 && <p className="muted">Altre fermate salvate:</p>}
        {stops.list.length > 6 && <ul className="plain">{stops.list.slice(6).map((s) => <li key={s.id}><Link href={`/stop/${encodeURIComponent(s.id)}`}>{s.label || s.name}</Link></li>)}</ul>}
      </section>

      <nav className="tiles" aria-label="Sezioni">
        <Link href="/nearby" className="tile"><span aria-hidden>📍</span><strong>Vicino a te</strong><span className="muted">Fermate vicine e prossimi arrivi</span></Link>
        <Link href="/map" className="tile"><span aria-hidden>🗺️</span><strong>Mappa live</strong><span className="muted">Mezzi con posizione GPS</span></Link>
        <Link href="/storico" className="tile"><span aria-hidden>📈</span><strong>Storico e stime</strong><span className="muted">Passaggi osservati sul tuo dispositivo</span></Link>
      </nav>
      <div className="actions"><ShareButton path="/" title="Bus Torino Live" /></div>
    </>
  );
}
