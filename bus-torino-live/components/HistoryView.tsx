'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clearHistory, exportHistory, getHistory, historyEnabled, setHistoryEnabled, stopNames, MAX_AGE_DAYS, MAX_OBS } from '@/lib/history';
import type { Obs } from '@/lib/estimate';
import { LineBadge } from './Bits';

const fmtD = (d: string) => `${d.slice(6, 8)}/${d.slice(4, 6)}`;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

export default function HistoryView() {
  const [obs, setObs] = useState<Obs[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const reload = () => { setObs([...getHistory()]); setNames(stopNames()); setOn(historyEnabled()); };
  useEffect(reload, []);

  const groups = useMemo(() => {
    const m = new Map<string, Obs[]>();
    for (const o of obs ?? []) { const k = `${o.s}|${o.l}`; (m.get(k) || m.set(k, []).get(k)!).push(o); }
    return [...m.entries()].map(([k, list]) => ({ k, stop: list[0].s, line: list[0].l, list: list.sort((a, b) => b.o - a.o) })).sort((a, b) => b.list.length - a.list.length);
  }, [obs]);

  function download() {
    const blob = new Blob([exportHistory()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bus-torino-live-storico.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (!obs) return <p className="muted">Carico lo storico…</p>;
  const days = new Set(obs.map((o) => o.d)).size;
  return (
    <>
      <p>
        Lo storico è salvato <strong>solo su questo dispositivo</strong> (nel browser) e non viene inviato a nessun server.
        {' '}Contiene: fermata, linea, direzione, data, orario programmato e ritardo osservato. Nessuna posizione, nessun dato personale.
      </p>
      <p><strong>{obs.length}</strong> passaggi registrati in <strong>{days}</strong> {days === 1 ? 'giorno' : 'giorni'}. Si conservano al massimo {MAX_OBS} passaggi e gli ultimi {MAX_AGE_DAYS} giorni.</p>
      <div className="actions">
        <button className="btn" type="button" onClick={() => { setHistoryEnabled(!on); setOn(!on); }} aria-pressed={on}>{on ? '⏸ Sospendi la raccolta' : '▶ Riattiva la raccolta'}</button>
        <button className="btn ghost" type="button" onClick={download} disabled={!obs.length}>Esporta (JSON)</button>
        <button className="btn ghost" type="button" disabled={!obs.length} onClick={() => { if (confirm('Cancellare tutto lo storico di questo dispositivo?')) { clearHistory(); reload(); } }}>Cancella storico</button>
      </div>
      {!on && <p className="muted">Raccolta sospesa: i nuovi passaggi non vengono registrati.</p>}

      {groups.length === 0
        ? <p className="muted">Ancora nessun passaggio registrato. Apri una fermata mentre ci sono mezzi in arrivo: quando una corsa con previsione realtime passa, viene registrata.</p>
        : (
          <ul className="plain hist">
            {groups.map((g) => {
              const med = Math.round(median(g.list.map((o) => o.dl)) / 60);
              return (
                <li key={g.k}>
                  <button className="link" type="button" onClick={() => setOpen(open === g.k ? null : g.k)}>
                    <LineBadge line={g.line} /> {names[g.stop] || `Fermata ${g.stop}`}
                  </button>
                  <span className="muted block">{g.list.length} {g.list.length === 1 ? 'passaggio' : 'passaggi'} · {new Set(g.list.map((o) => o.d)).size} giorni · ritardo mediano {med > 0 ? '+' : ''}{med} min{g.list.length < 3 ? ' · dati insufficienti per una stima' : ''}</span>
                  {open === g.k && (
                    <ul className="plain tight">
                      {g.list.slice(0, 12).map((o) => <li key={o.k}>{fmtD(o.d)} · programmato {hhmm(o.m)} · {o.dl >= 0 ? '+' : ''}{Math.round(o.dl / 60)} min{o.h ? ` · ${o.h}` : ''}</li>)}
                      <li><Link href={`/stop/${encodeURIComponent(g.stop)}`}>Apri la fermata</Link></li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

      <h2>Come vengono calcolate le stime</h2>
      <ul className="plain">
        <li>Un passaggio viene registrato quando, con questa pagina aperta, una corsa con previsione realtime GTT sparisce dall'elenco dopo l'orario previsto. Il valore salvato è il ritardo dell'<strong>ultima previsione realtime vista</strong> rispetto all'orario programmato: non è la misura GPS dell'arrivo effettivo.</li>
        <li>Per ogni passaggio programmato si cercano le osservazioni della stessa fermata e linea (e direzione, se bastano) con orario simile: prima lo stesso giorno della settimana (±45 min), poi giorni feriali / sabati / domeniche (±60 min), infine tutti i giorni (±90 min). Serve almeno 3 osservazioni; si preferisce il gruppo più specifico con almeno 5.</li>
        <li>La stima è l'orario programmato più il <strong>ritardo mediano</strong> di quelle osservazioni (le ultime 40). Ritardi oltre 45 minuti sono scartati come anomalie.</li>
        <li><strong>Affidabilità:</strong> 🟢 alta = almeno 10 passaggi in 5 giorni diversi, giorno o tipo di giorno specifico e variabilità entro ±2 min; 🟡 media = almeno 5 passaggi in 3 giorni e variabilità entro ±5 min; 🔴 altrimenti. Sono soglie scelte dal progetto, non garanzie.</li>
        <li>La stima si mostra solo per le corse senza previsione realtime. Quando esiste la previsione GTT, prevale sempre.</li>
      </ul>

      <h2>Come migliorare le previsioni</h2>
      <ul className="plain">
        <li>Usa spesso la stessa fermata e salvala tra le tue fermate.</li>
        <li>Tieni aperta la pagina della fermata quando ti avvicini all'orario del passaggio: lo storico si riempie solo mentre l'app è aperta.</li>
        <li>Più passaggi vengono osservati, più la stima può diventare precisa. Con pochi dati è meno affidabile e l'app lo dichiara.</li>
        <li>Deviazioni, scioperi o cambi di servizio rendono lo storico meno rappresentativo.</li>
        <li>Se il realtime GTT non è disponibile, nulla viene registrato.</li>
        <li>Non esiste una precisione garantita: la stima è un'indicazione, non un impegno.</li>
      </ul>
    </>
  );
}
