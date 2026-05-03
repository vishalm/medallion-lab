import { useEffect, useState } from 'react';
import { Panel } from '../Panel';
import { DataTable } from '../DataTable';
import { Callout } from '../Callout';
import { api } from '../../lib/api';

type SourceId = 'concur' | 'card';

const SOURCE_META: Record<SourceId, {
  label: string; file: string; pitch: string; quirks: string[];
}> = {
  concur: {
    label: 'Concur expenses',
    file: 'expenses_concur.json',
    pitch: 'Employee-submitted reimbursements. Flexible form, mixed quality.',
    quirks: [
      "submitted_date — three different formats: ISO, DD/MM/YYYY, MM-DD-YYYY",
      "currency — mostly AED, some USD (employees travel)",
      "merchant — sometimes 'Amazon', sometimes 'AMZN MKTPLACE' (free-text)",
      "category — chosen by employee, occasionally wrong",
    ],
  },
  card: {
    label: 'Corporate card statement',
    file: 'corporate_amex.csv',
    pitch: 'Bank-side feed. Clean structure but cryptic vendor strings.',
    quirks: [
      "amount_usd — USD only, no currency column at all",
      "vendor_str — gnarly: 'AMZN MKTPLACE', 'UBER *TRIP', 'MSFT*AZURE'",
      "employee_id — sometimes NULL (shared cards)",
      "no category — just card data, you have to derive it",
    ],
  },
};

export function MessStage() {
  const [source, setSource] = useState<SourceId>('concur');
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    api.finRaw(source, 12).then((r) => {
      if (!cancelled) setRows(r.rows);
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [source]);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr,1fr] gap-3">
        {(Object.keys(SOURCE_META) as SourceId[]).map((id) => {
          const meta = SOURCE_META[id];
          const isActive = id === source;
          return (
            <button
              key={id}
              onClick={() => setSource(id)}
              className={`text-left rounded-xl px-4 py-3 border transition
                ${isActive
                  ? 'border-gold-400/60 bg-gold-300/10'
                  : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-display text-base text-zinc-50">{meta.label}</div>
                <code className="text-[11px] text-zinc-500 font-mono">{meta.file}</code>
              </div>
              <p className="mt-1 text-xs text-zinc-400">{meta.pitch}</p>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
        <Panel
          title={`Raw rows · ${SOURCE_META[source].file}`}
          subtitle="A peek at the file before any transformation"
          right={busy ? <span className="text-xs text-zinc-500">loading…</span> : null}
        >
          <DataTable rows={rows} maxHeight={420} />
        </Panel>

        <Panel title="Why this is a mess" tone="bronze">
          <ul className="space-y-2 text-sm text-zinc-300">
            {SOURCE_META[source].quirks.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-bronze-300 mt-1">•</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
            Two files, two shapes. Neither one alone tells the CFO what
            they need to know — and they don't even agree on currency.
          </p>
        </Panel>
      </div>

      <Callout tone="violet" title="Teaching point — MESS">
        Real finance data lands from 5–15 systems (Concur, Amex, ERP, vendor
        portals). They never agree on column names, formats, currencies, or
        vendor strings. Switch between the two sources above and watch the
        same vendor appear differently in each — that's the gap the next
        stage closes.
      </Callout>
    </div>
  );
}
