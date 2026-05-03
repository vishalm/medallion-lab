import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Panel } from '../Panel';
import { DataTable } from '../DataTable';
import { Callout } from '../Callout';
import { api } from '../../lib/api';
import { fmtNum } from '../../lib/format';
import { IconArrowRight, IconBolt, IconCheck, IconPlay } from '../../icons';

type LayerKey = 'concur' | 'card' | 'silver' | 'gold_spend' | 'gold_vendors';
type Tone = 'bronze' | 'silver' | 'gold';

// Static class lookup — Tailwind purges classes it can't see at build
// time, so we never interpolate `border-${tone}-...` style strings.
const TAB_CLASS: Record<Tone, string> = {
  bronze: 'border-bronze-500/60 bg-bronze-500/10 text-bronze-100',
  silver: 'border-silver-500/60 bg-silver-500/10 text-silver-100',
  gold:   'border-gold-500/60 bg-gold-500/10 text-gold-100',
};

const LAYER_TABS: { id: LayerKey; label: string; tone: Tone }[] = [
  { id: 'concur',       label: 'Bronze · Concur',     tone: 'bronze' },
  { id: 'card',         label: 'Bronze · Card',       tone: 'bronze' },
  { id: 'silver',       label: 'Silver · unified',    tone: 'silver' },
  { id: 'gold_spend',   label: 'Gold · spend mart',   tone: 'gold' },
  { id: 'gold_vendors', label: 'Gold · vendor mart',  tone: 'gold' },
];

export function TrustStage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [layer, setLayer] = useState<LayerKey>('silver');
  const [rows, setRows] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<any>(null);

  const refresh = async () => {
    const [c, sample] = await Promise.all([
      api.finCounts(),
      api.finSample(layer, 15),
    ]);
    setCounts(c);
    setRows(sample.rows);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [layer]);

  const runPipeline = async () => {
    setRunning(true);
    try {
      const result = await api.finRunPipeline();
      setLastRun(result);
      await refresh();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Bronze → Silver → Gold"
        subtitle="The trust layer: messy raw inputs become a clean, query-ready warehouse"
        right={
          <button onClick={runPipeline} disabled={running} className="btn-gold text-xs">
            <IconPlay size={14} /> {running ? 'Running…' : 'Run pipeline'}
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-3 items-stretch">
          <LayerCard
            tone="bronze"
            title="Bronze"
            sub="raw landing"
            items={[
              { label: 'Concur rows', n: counts.bronze_concur },
              { label: 'Card rows', n: counts.bronze_card },
            ]}
          />
          <LayerCard
            tone="silver"
            title="Silver"
            sub="unioned · FX-AED · vendor canonical"
            items={[
              { label: 'Transactions', n: counts.silver },
            ]}
            running={running}
          />
          <LayerCard
            tone="gold"
            title="Gold"
            sub="semantic marts"
            items={[
              { label: 'Spend × dept × month', n: counts.gold_spend },
              { label: 'Top vendors', n: counts.gold_vendors },
            ]}
            running={running}
          />
        </div>

        {lastRun && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs"
          >
            <RunStat label="Silver inserted" value={fmtNum(lastRun.silver?.silver_inserted)} ok />
            <RunStat label="Bad dates dropped" value={fmtNum(lastRun.silver?.bad_dates ?? 0)}
                     ok={lastRun.silver?.bad_dates === 0} />
            <RunStat label="Vendor misses" value={fmtNum(lastRun.silver?.vendor_misses ?? 0)}
                     ok={lastRun.silver?.vendor_misses === 0} />
            <RunStat label="Orphan employees" value={fmtNum(lastRun.silver?.orphan_employee ?? 0)}
                     ok={lastRun.silver?.orphan_employee === 0} />
          </motion.div>
        )}
      </Panel>

      <Panel
        title="Inspect the layers"
        subtitle="Same data, three views. Click a tab to see what each layer looks like."
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {LAYER_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setLayer(t.id)}
              className={`text-xs px-3 py-1.5 rounded-md border transition
                ${layer === t.id
                  ? TAB_CLASS[t.tone]
                  : 'border-white/5 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <DataTable rows={rows} maxHeight={360} />
      </Panel>

      <Callout tone="violet" title="Teaching point — TRUST">
        Bronze is what landed. Silver is what's true. Gold is what's useful.
        Press <strong>Run pipeline</strong>, then switch to the{' '}
        <em>Silver · unified</em> tab — &ldquo;AMZN MKTPLACE&rdquo; and
        &ldquo;Amazon&rdquo; have collapsed into one canonical vendor. Same
        shape powers Databricks, Snowflake, Microsoft Fabric: messy → trusted → opinionated.
      </Callout>
    </div>
  );
}

function LayerCard({
  tone, title, sub, items, running,
}: {
  tone: 'bronze' | 'silver' | 'gold';
  title: string;
  sub: string;
  items: { label: string; n: number | undefined }[];
  running?: boolean;
}) {
  const toneRing = {
    bronze: 'from-bronze-300/40 to-bronze-300/0',
    silver: 'from-silver-300/40 to-silver-300/0',
    gold: 'from-gold-300/40 to-gold-300/0',
  }[tone];
  const toneText = {
    bronze: 'text-bronze-300',
    silver: 'text-silver-300',
    gold: 'text-gold-300',
  }[tone];
  return (
    <div className={`relative panel p-4 overflow-hidden`}>
      <div
        className={`absolute -top-px left-0 right-0 h-px bg-gradient-to-r ${toneRing}`}
        aria-hidden
      />
      <div className="flex items-baseline gap-2">
        <span className={`font-display text-lg ${toneText}`}>{title}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">{sub}</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
        {items.map((it, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3">
            <span className="text-zinc-400 text-xs">{it.label}</span>
            <span className="font-mono tabular-nums text-zinc-100">
              {it.n === undefined ? '—' : fmtNum(it.n)}
            </span>
          </li>
        ))}
      </ul>
      {running && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(241,176,44,0.15), transparent 60%)' }}
        />
      )}
    </div>
  );
}

function RunStat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 flex items-center gap-2">
      <span className={ok ? 'text-emerald-300' : 'text-amber-300'}>
        {ok ? <IconCheck size={14} /> : <IconBolt size={14} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 truncate">{label}</div>
        <div className="text-sm tabular-nums text-zinc-100">{value}</div>
      </div>
    </div>
  );
}

// Unused helper kept lean; if needed later as a section divider:
export function StageArrow() {
  return <IconArrowRight size={16} className="text-zinc-600" />;
}
