import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { DataTable } from '../components/DataTable';
import { Stat } from '../components/Stat';
import { StudentNote } from '../components/Callout';
import { api } from '../lib/api';
import { fmtMs } from '../lib/format';
import { IconBolt, IconPlay } from '../icons';

const STARTER = `-- Compare the same question on three layers. Click Run.
SELECT p.category, ROUND(SUM(f.amount), 2) AS revenue
FROM gold_fact_sales f
JOIN gold_dim_product p ON p.product_id = f.product_id
GROUP BY p.category
ORDER BY revenue DESC;`;

export default function Act7Sql() {
  const [sql, setSql] = useState(STARTER);
  const [examples, setExamples] = useState<{ label: string; sql: string }[]>([]);
  const [result, setResult] = useState<any>(null);
  const [explain, setExplain] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.sqlExamples().then((r) => setExamples(r.examples));
  }, []);

  const run = async () => {
    setBusy(true); setExplain(null);
    try { setResult(await api.sqlRun(sql)); } finally { setBusy(false); }
  };
  const runExplain = async () => {
    setBusy(true);
    try { setExplain(await api.sqlExplain(sql)); } finally { setBusy(false); }
  };

  return (
    <div>
      <ActHeader
        actNumber="07"
        eyebrow="Bonus · SQL playground"
        title="Query the three layers yourself."
        subtitle="Monaco editor, read-only SQLite connection, only SELECT / WITH / EXPLAIN allowed. The starter examples on the right walk through Bronze, Silver, Gold, plus the data-quality log."
      />

      <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
        <Panel
          title="Editor"
          right={
            <div className="flex gap-2">
              <button onClick={run} disabled={busy} className="btn-gold text-xs">
                <IconPlay size={14} /> Run
              </button>
              <button onClick={runExplain} disabled={busy} className="btn text-xs">
                <IconBolt size={14} /> Explain plan
              </button>
            </div>
          }
        >
          <div className="monaco-container rounded-lg overflow-hidden border border-zinc-800">
            <Editor
              value={sql}
              onChange={(v) => setSql(v ?? '')}
              language="sql"
              theme="vs-dark"
              height="280px"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                fontFamily: 'JetBrains Mono, ui-monospace',
              }}
            />
          </div>

          {result && !result.error && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Rows" value={result.row_count ?? 0} />
                <Stat label="Latency" value={fmtMs(result.latency_ms ?? 0)} tone="gold" />
                <Stat label="Truncated" value={result.truncated ? 'yes' : 'no'} tone={result.truncated ? 'rose' : 'emerald'} />
              </div>
              <DataTable rows={result.rows ?? []} maxHeight={320} />
            </div>
          )}
          {result?.error && (
            <div className="mt-4 rounded-md border border-rose-700/50 bg-rose-900/25 text-rose-200 text-sm px-3 py-2">
              {result.error}
            </div>
          )}
          {explain && !explain.error && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Query plan</div>
              <DataTable rows={explain.rows ?? []} maxHeight={220} />
            </div>
          )}
        </Panel>

        <Panel title="Teaching examples" subtitle="click to load into the editor">
          <ul className="space-y-1">
            {examples.map((e, i) => (
              <li key={i}>
                <button
                  onClick={() => setSql(e.sql)}
                  className="w-full text-left rounded-lg px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 border border-transparent hover:border-white/10 transition"
                >
                  {e.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-500 mt-6 leading-relaxed">
            The database is read-only. You can't drop, insert, or alter -
            try it, and you'll get a friendly error.
          </p>
        </Panel>
      </div>

      <div className="mt-6">
        <StudentNote title="What you're really learning here">
          Open the <strong>DQ events</strong> example and run it. That single query is what every
          production observability tool - Monte Carlo, Great Expectations, Soda, Elementary -
          reduces to under the hood: a SELECT over a log of anomalies. The product is the alerts,
          the dashboards, the pager. The core is a query.
        </StudentNote>
      </div>
    </div>
  );
}
