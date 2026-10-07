'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LineBadge, Notice } from './Bits';

export default function AllLines() {
  const [lines, setLines] = useState<{ line: string; name: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState('');
  useEffect(() => { fetch('/api/lines').then((r) => r.json()).then((j) => (j.error ? setErr(j.error) : setLines(j.lines))).catch((e) => setErr(e.message)); }, []);
  const shown = useMemo(() => {
    const q = f.trim().toLowerCase();
    return (lines || []).filter((l) => !q || l.line.toLowerCase().startsWith(q) || l.name.toLowerCase().includes(q));
  }, [lines, f]);
  if (err) return <Notice kind="error">{err}</Notice>;
  if (!lines) return <p className="muted">Carico le linee…</p>;
  return (
    <>
      <p className="muted">{lines.length} linee nei dati GTT. Tocca una linea per vedere fermate, percorso e mezzi.</p>
      <input className="filter" type="search" placeholder="Filtra per numero o destinazione" value={f} onChange={(e) => setF(e.target.value)} />
      <ul className="all-lines">
        {shown.map((l) => (
          <li key={l.line}><Link href={`/line/${encodeURIComponent(l.line)}`}><LineBadge line={l.line} /><span>{l.name || 'Percorso non indicato'}</span></Link></li>
        ))}
        {shown.length === 0 && <li className="muted">Nessuna linea corrisponde.</li>}
      </ul>
    </>
  );
}
