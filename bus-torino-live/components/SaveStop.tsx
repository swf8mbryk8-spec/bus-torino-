'use client';
import { useState } from 'react';
import { useLocalList } from '@/lib/client';

export type SavedStop = { id: string; name: string; code?: string; label?: string; lines?: string[] };
const SUGGEST = ['Casa', 'Lavoro', 'Università', 'Palestra'];

export default function SaveStop({ stop }: { stop: SavedStop }) {
  const { list, save } = useLocalList<SavedStop>('btl:stops', []);
  const cur = list.find((s) => s.id === stop.id);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');

  function openForm() { setLabel(cur?.label || ''); setOpen(true); }
  function commit() {
    const item: SavedStop = { ...stop, label: label.trim() || undefined };
    save(cur ? list.map((s) => (s.id === stop.id ? item : s)) : [...list, item]);
    setOpen(false);
  }
  function remove() { save(list.filter((s) => s.id !== stop.id)); setOpen(false); }

  if (!open) {
    return (
      <button className={`btn ${cur ? 'on' : ''}`} type="button" onClick={openForm}>
        {cur ? `★ ${cur.label || 'Fermata salvata'}` : '☆ Salva fermata'}
      </button>
    );
  }
  return (
    <form className="save-form" onSubmit={(e) => { e.preventDefault(); commit(); }}>
      <label htmlFor="sl">Nome personalizzato (facoltativo)</label>
      <input id="sl" className="filter" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} placeholder="Es. Casa" autoFocus />
      <div className="chips">{SUGGEST.map((s) => <button key={s} type="button" className="btn ghost" onClick={() => setLabel(s)}>{s}</button>)}</div>
      <div className="actions">
        <button className="btn primary" type="submit">{cur ? 'Aggiorna' : 'Salva'}</button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Annulla</button>
        {cur && <button className="btn ghost" type="button" onClick={remove}>Rimuovi dai preferiti</button>}
      </div>
    </form>
  );
}
