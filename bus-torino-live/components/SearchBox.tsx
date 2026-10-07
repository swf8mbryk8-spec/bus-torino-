'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineBadge } from './Bits';

type R =
  | { type: 'line'; id: string; line: string; name: string; fuzzy: boolean }
  | { type: 'stop'; id: string; code: string; name: string; desc: string; lines: string[]; fuzzy: boolean };

export default function SearchBox({ onPickLine, placeholder }: { onPickLine?: (line: string) => void; placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<R[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 1) { setRes(null); setErr(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/search?q=' + encodeURIComponent(q));
        const j = await r.json();
        if (my !== seq.current) return;
        if (!r.ok) throw new Error(j.error || 'Errore');
        setRes(j.results); setErr(null);
      } catch (e) { if (my === seq.current) setErr((e as Error).message); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const firstFuzzy = res ? res.findIndex((r) => r.fuzzy) : -1;
  const pickLine = (line: string) => {
    if (onPickLine) { onPickLine(line); setQ(''); setRes(null); }
    else router.push('/line/' + encodeURIComponent(line));
  };

  return (
    <div className="search">
      <label className="sr-only" htmlFor="q">Cerca fermata, linea o destinazione</label>
      <input id="q" type="search" inputMode="search" autoComplete="off" autoCorrect="off" value={q}
        onChange={(e) => setQ(e.target.value)} placeholder={placeholder || '🔎 Cerca fermata, linea o destinazione'} />
      {err && <p className="muted">{err}</p>}
      {res && res.length === 0 && <p className="muted">Nessun risultato per “{q}”. Prova il nome o il codice della fermata, il numero della linea o il comune.</p>}
      {res && res.length > 0 && (
        <ul className="results">
          {res.map((r, i) => [
            i === firstFuzzy ? <li key={'m' + i} className="maybe">Forse cercavi:</li> : null,
            r.type === 'line' ? (
              <li key={'l' + r.id}>
                <button type="button" onClick={() => pickLine(r.line)}>
                  <LineBadge line={r.line} /><span className="grow">{r.name || 'Linea ' + r.line}</span>
                </button>
              </li>
            ) : (
              <li key={'s' + r.id}>
                <button type="button" onClick={() => router.push('/stop/' + encodeURIComponent(r.id))}>
                  <span className="grow">
                    <strong>{r.name}</strong>
                    <span className="muted block">{r.code ? `Codice ${r.code}` : 'Codice non disponibile'}{r.desc && ` · ${r.desc}`}</span>
                    <span className="mini-lines">{r.lines.map((l) => <LineBadge key={l} line={l} />)}</span>
                  </span>
                </button>
              </li>
            ),
          ])}
        </ul>
      )}
    </div>
  );
}
