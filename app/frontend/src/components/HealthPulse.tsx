import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Status = 'pending' | 'ok' | 'down';

export function HealthPulse() {
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        const r = await api.health();
        if (alive) setStatus(r.status === 'ok' ? 'ok' : 'down');
      } catch {
        if (alive) setStatus('down');
      }
    };
    ping();
    const id = setInterval(ping, 8000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const colors: Record<Status, { dot: string; halo: string; label: string }> = {
    pending: { dot: 'bg-zinc-500', halo: 'bg-zinc-500/40', label: 'checking' },
    ok: { dot: 'bg-emerald-400', halo: 'bg-emerald-400/40', label: 'API live' },
    down: { dot: 'bg-rose-400', halo: 'bg-rose-400/40', label: 'API unreachable' },
  };
  const c = colors[status];

  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
      <span className="relative inline-flex">
        <span className={`absolute inline-flex h-2 w-2 rounded-full ${c.halo} ${status === 'ok' ? 'animate-ping' : ''}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
      </span>
      <span>{c.label}</span>
    </div>
  );
}
