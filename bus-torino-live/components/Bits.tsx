'use client';
import { useState } from 'react';
import { TIER } from '@/lib/client';
import type { Tier } from '@/lib/types';

export function LineBadge({ line }: { line: string }) {
  return <span className="line-badge" aria-label={`Linea ${line}`}>{line}</span>;
}

export function TierBadge({ tier }: { tier: Tier }) {
  const t = TIER[tier];
  return <span className={`tier ${t.cls}`} title={t.hint}><span aria-hidden>{t.icon}</span> {t.label}</span>;
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  const [msg, setMsg] = useState('');
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setMsg('Link copiato');
    } catch {
      try { await navigator.clipboard.writeText(url); setMsg('Link copiato'); } catch { setMsg(url); }
    }
    setTimeout(() => setMsg(''), 3000);
  }
  return (
    <button className="btn" onClick={share} type="button">
      ↗ Condividi{msg && <span className="btn-note"> · {msg}</span>}
    </button>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error'; children: React.ReactNode }) {
  return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : undefined}>{children}</div>;
}

export function AlertList({ alerts }: { alerts: { id: string; header: string; description: string; url: string | null }[] }) {
  if (!alerts?.length) return null;
  return (
    <section aria-label="Avvisi di servizio">
      {alerts.map((a) => (
        <Notice key={a.id} kind="warn">
          <strong>{a.header || 'Avviso di servizio'}</strong>
          {a.description && <div>{a.description}</div>}
          {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer">Dettagli GTT</a>}
        </Notice>
      ))}
    </section>
  );
}
