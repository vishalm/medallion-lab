import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Panel } from '../Panel';
import { Stat } from '../Stat';
import { Callout } from '../Callout';
import { PredictExtra } from './PredictExtra';
import { api } from '../../lib/api';
import { fmtMoney, fmtNum } from '../../lib/format';
import { IconAlert } from '../../icons';

export function PredictStage() {
  const [sensitivity, setSensitivity] = useState(0.05);
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAnomalies = async (s: number) => {
    setBusy(true);
    try {
      setData(await api.finAnomalies(s, 12));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { fetchAnomalies(sensitivity); /* eslint-disable-next-line */ }, []);

  // Debounce slider so we don't spam the model.
  useEffect(() => {
    const t = setTimeout(() => fetchAnomalies(sensitivity), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [sensitivity]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total transactions" value={data ? fmtNum(data.total_rows) : '-'} />
        <Stat label="Flagged outliers" tone="rose"
          value={data ? fmtNum(data.outlier_count) : '-'}
          hint={data ? `${(data.outlier_count / Math.max(1, data.total_rows) * 100).toFixed(1)}% of total` : undefined} />
        <Stat label="Median txn (AED)" value={data ? fmtMoney(data.median_amount_aed) : '-'} />
        <Stat label="Sensitivity" tone="gold"
          value={`${(sensitivity * 100).toFixed(1)}%`}
          hint="contamination parameter" />
      </div>

      <Panel
        title="Sensitivity"
        subtitle="Slide left for fewer, more confident outliers. Slide right to cast a wider net."
      >
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 font-mono">0.5%</span>
          <input
            type="range"
            min={0.005} max={0.20} step={0.005}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="flex-1 accent-gold-300"
          />
          <span className="text-xs text-zinc-500 font-mono">20%</span>
          <span className="ml-3 font-mono text-sm text-gold-300 tabular-nums w-14 text-right">
            {(sensitivity * 100).toFixed(1)}%
          </span>
        </div>
      </Panel>

      <Panel
        title="Flagged transactions"
        subtitle="Ranked by amount. Each card explains why the model thought this was weird."
        right={busy ? <span className="text-xs text-zinc-500">scoring…</span> : null}
      >
        {data && data.flagged.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">
            No anomalies at this sensitivity. Slide right to flag more.
          </div>
        ) : (
          <ul className="space-y-2">
            {data?.flagged?.map((row: any) => (
              <motion.li
                key={row.txn_id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-rose-700/30 bg-rose-900/10 p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-rose-300"><IconAlert size={14} /></span>
                    <span className="font-display text-base text-zinc-50">
                      {fmtMoney(row.amount_aed)} AED
                    </span>
                    <span className="text-xs text-zinc-400">
                      {row.vendor ?? '-'} · {row.category ?? '-'}
                    </span>
                  </div>
                  <code className="text-[11px] text-zinc-500 font-mono shrink-0">
                    {row.txn_id}
                  </code>
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  {row.employee} · {row.department} · {row.txn_date} · {row.source}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {row.reasons.map((r: string, i: number) => (
                    <span key={i}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-rose-700/20 text-rose-200 border border-rose-700/40">
                      {r}
                    </span>
                  ))}
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-zinc-400 border border-white/5 ml-auto">
                    score {row.anomaly_score.toFixed(3)}
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </Panel>

      <Callout tone="violet" title="Teaching point - PREDICT">
        This is an <strong>Isolation Forest</strong> - unsupervised, no
        labels needed. It learns the &ldquo;normal&rdquo; shape of expenses
        across amount, day-of-week, dept, and category. Anything far from
        that shape gets flagged. Crank the sensitivity slider up - the list
        grows with smaller weirdness (false-positive cost). Drop it to 1%
        and only the high-blast-radius outliers remain. Choosing that
        slider is the entire job of an ML/risk team. Same algorithm powers
        fraud detection, intrusion detection, and equipment-failure alerts
        in production.
      </Callout>

      <div className="pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="text-[11px] uppercase tracking-[0.25em] mb-3"
             style={{ color: 'var(--text-3)' }}>
          More predictions
        </div>
        <PredictExtra />
      </div>
    </div>
  );
}
