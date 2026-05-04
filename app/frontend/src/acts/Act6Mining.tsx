import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, AreaChart, Area, BarChart, Bar, Legend,
} from 'recharts';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { DataTable } from '../components/DataTable';
import { StudentNote } from '../components/Callout';
import { api } from '../lib/api';
import { fmtNum } from '../lib/format';

type Tab = 'clustering' | 'classification' | 'regression' | 'association' | 'anomaly';

const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: 'classification', label: 'Classification', blurb: 'What class is this? (churn risk)' },
  { key: 'regression', label: 'Regression', blurb: 'How much next month? (revenue)' },
  { key: 'clustering', label: 'Clustering', blurb: 'Who belongs together? (k-means)' },
  { key: 'association', label: 'Association', blurb: 'What goes with what? (Apriori)' },
  { key: 'anomaly', label: 'Anomaly', blurb: 'What is weird? (IsolationForest on txns)' },
];

const CLUSTER_COLORS = ['#f1b02c', '#a78bfa', '#34d399', '#f87171', '#60a5fa', '#fb923c'];

export default function Act6Mining() {
  const [tab, setTab] = useState<Tab>('classification');
  return (
    <div>
      <ActHeader
        actNumber="06"
        eyebrow="Data mining → AI"
        slideRef="20–23"
        title="Five techniques. One cheat sheet."
        subtitle="When a business problem lands on your desk, you pattern-match to one of five shapes. Every demo below runs live against the Gold layer (or the banking table). Read the blurb, move the slider, watch the model react."
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn text-xs ${tab === t.key ? 'btn-gold' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 text-sm text-zinc-400">
        <span className="font-medium text-zinc-200">{TABS.find(t => t.key === tab)!.label}:</span>{' '}
        {TABS.find(t => t.key === tab)!.blurb}
      </div>

      <div className="mb-6">
        <StudentNote title="How to pick a technique">
          When a problem lands on your desk, ask which shape it fits: <strong>labeled class?</strong> classification ·{' '}
          <strong>numeric target?</strong> regression · <strong>groups unknown?</strong> clustering ·{' '}
          <strong>what-goes-with-what?</strong> association · <strong>"this looks weird"?</strong> anomaly.
          Pattern-match first, tune hyperparameters later.
        </StudentNote>
      </div>

      {tab === 'clustering' && <Clustering />}
      {tab === 'classification' && <Classification />}
      {tab === 'regression' && <Regression />}
      {tab === 'association' && <Association />}
      {tab === 'anomaly' && <Anomaly />}
    </div>
  );
}

/* ------------------ CLUSTERING ------------------ */
function Clustering() {
  const [k, setK] = useState(4);
  const [data, setData] = useState<any>(null);

  useEffect(() => { api.clustering(k).then(setData); }, [k]);

  if (!data || data.error) return <Panel title="Clustering"><p className="text-sm text-zinc-400">{data?.error ?? 'Loading…'}</p></Panel>;

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
      <Panel
        title="Customer segmentation"
        subtitle="spend × recency · each dot one customer"
        right={
          <label className="text-xs flex items-center gap-2">
            k = <input type="range" min={2} max={6} value={k} onChange={(e) => setK(+e.target.value)} className="accent-gold-500" />
            <span className="font-mono text-gold-300 w-6 text-center">{k}</span>
          </label>
        }
      >
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" dataKey="total_spend" name="Total spend" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: 'Total spend', position: 'insideBottomRight', offset: -10, fill: '#71717a', fontSize: 11 }} />
              <YAxis type="number" dataKey="recency_days" name="Recency (days)" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: 'Recency (days)', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: 12 }} />
              {Array.from({ length: k }).map((_, ci) => (
                <Scatter
                  key={ci}
                  name={`Cluster ${ci}`}
                  data={data.points.filter((p: any) => p.cluster === ci)}
                  fill={CLUSTER_COLORS[ci]}
                  shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={3.5} fill={CLUSTER_COLORS[ci]} fillOpacity={0.75} />}
                />
              ))}
              <Scatter name="Centroid" data={data.centroids} fill="#fff" shape={(props: any) => (
                <g>
                  <circle cx={props.cx} cy={props.cy} r={9} fill="none" stroke="#fff" strokeDasharray="2 2" />
                  <circle cx={props.cx} cy={props.cy} r={3} fill="#fff" />
                </g>
              )} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Cluster summary">
        <div className="space-y-2 text-xs font-mono">
          {data.summary.map((s: any) => (
            <div key={s.cluster} className="flex items-center justify-between rounded-md px-3 py-2 border border-zinc-800" style={{ backgroundColor: CLUSTER_COLORS[s.cluster] + '18' }}>
              <span style={{ color: CLUSTER_COLORS[s.cluster] }}>Cluster {s.cluster}</span>
              <span className="text-zinc-300">n={s.n}</span>
              <span className="text-zinc-400">spend ~{fmtNum(s.avg_spend, 0)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
          k-means on <code>txns</code>, <code>total_spend</code>, <code>avg_basket</code>, <code>recency_days</code>. Standardized, then clustered. The chart projects to spend × recency for readability.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------ CLASSIFICATION ------------------ */
function Classification() {
  const [threshold, setThreshold] = useState(30);
  const [data, setData] = useState<any>(null);

  useEffect(() => { api.classification(threshold).then(setData); }, [threshold]);

  if (!data) return <Panel title="Classification"><p className="text-sm text-zinc-400">Loading…</p></Panel>;
  if (data.error) return <Panel title="Classification"><p className="text-sm text-rose-300">{data.error}</p></Panel>;

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
      <Panel
        title="Churn risk · logistic regression"
        subtitle="decision boundary redraws as you move the slider"
        right={
          <label className="text-xs flex items-center gap-2">
            churn if inactive ≥
            <input type="range" min={7} max={90} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="accent-gold-500" />
            <span className="font-mono text-gold-300 w-8 text-center">{threshold}d</span>
          </label>
        }
      >
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" dataKey="total_spend" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: 'Total spend', position: 'insideBottomRight', offset: -10, fill: '#71717a', fontSize: 11 }} />
              <YAxis type="number" dataKey="txns" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: 'Transactions', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: 12 }} />
              <Scatter
                name="Grid"
                data={data.grid}
                shape={(props: any) => {
                  const p = props.payload.churn_prob;
                  const r = 6;
                  return <rect x={props.cx - r} y={props.cy - r} width={r * 2} height={r * 2} fill={probColor(p)} fillOpacity={0.28} />;
                }}
              />
              <Scatter
                name="Active"
                data={data.points.filter((p: any) => p.churned === 0)}
                shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={3.5} fill="#34d399" fillOpacity={0.85} />}
              />
              <Scatter
                name="Churned"
                data={data.points.filter((p: any) => p.churned === 1)}
                shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={3.5} fill="#f87171" fillOpacity={0.9} />}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Model snapshot">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Accuracy" value={data.accuracy} tone="gold" />
          <Stat label="Threshold" value={`${threshold}d`} />
          <Stat label="Active" value={data.counts.active} tone="emerald" />
          <Stat label="Churned" value={data.counts.churned} tone="rose" />
        </div>
        <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
          Background heatmap = predicted P(churn). Green dots = still active. Red = past the threshold.
          Move the slider to see the boundary pivot.
        </p>
      </Panel>
    </div>
  );
}

function probColor(p: number): string {
  // green (low) -> amber -> red (high)
  if (p < 0.35) return '#34d399';
  if (p < 0.65) return '#f1b02c';
  return '#f87171';
}

/* ------------------ REGRESSION ------------------ */
function Regression() {
  const [horizon, setHorizon] = useState(21);
  const [data, setData] = useState<any>(null);

  useEffect(() => { api.regression(horizon).then(setData); }, [horizon]);

  if (!data || data.error) return <Panel title="Regression"><p className="text-sm text-zinc-400">{data?.error ?? 'Loading…'}</p></Panel>;

  const merged = [
    ...data.history.map((h: any) => ({ date_id: h.date_id, actual: h.revenue, fit: h.predicted })),
    ...data.future.map((f: any) => ({ date_id: f.date_id, forecast: f.predicted, lo: f.lo, hi: f.hi })),
  ];

  return (
    <Panel
      title="Daily revenue forecast"
      subtitle={`slope ≈ ${data.slope.toFixed(1)} per day · σ ≈ ${data.sigma.toFixed(0)}`}
      right={
        <label className="text-xs flex items-center gap-2">
          horizon
          <input type="range" min={7} max={60} value={horizon} onChange={(e) => setHorizon(+e.target.value)} className="accent-gold-500" />
          <span className="font-mono text-gold-300 w-6 text-center">{horizon}</span>
        </label>
      }
    >
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={merged} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <defs>
              <linearGradient id="fcBand" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f1b02c" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f1b02c" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="date_id" stroke="#71717a" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: 12 }} />
            <Area type="monotone" dataKey="hi" stroke="none" fill="url(#fcBand)" />
            <Area type="monotone" dataKey="lo" stroke="none" fill="#09090b" />
            <Line type="monotone" dataKey="actual" stroke="#93a0ac" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="fit" stroke="#f1b02c" strokeWidth={1} strokeDasharray="3 3" dot={false} />
            <Line type="monotone" dataKey="forecast" stroke="#f1b02c" strokeWidth={2} dot={false} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/* ------------------ ASSOCIATION ------------------ */
function Association() {
  const [minSupport, setMinSupport] = useState(0.005);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.association(minSupport, 0.15).then(setData);
  }, [minSupport]);

  if (!data || data.error) return <Panel title="Association"><p className="text-sm text-zinc-400">{data?.error ?? 'Loading…'}</p></Panel>;

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
      <Panel
        title="Market basket rules"
        subtitle={`${data.basket_count} baskets · ${data.itemsets ?? 0} frequent itemsets`}
        right={
          <label className="text-xs flex items-center gap-2">
            min-support
            <input type="range" min={1} max={30} value={Math.round(minSupport * 1000)}
              onChange={(e) => setMinSupport(+e.target.value / 1000)}
              className="accent-gold-500" />
            <span className="font-mono text-gold-300 w-12 text-center">{minSupport.toFixed(3)}</span>
          </label>
        }
      >
        <div className="space-y-2 max-h-[420px] overflow-auto scroll-thin pr-1">
          {data.rules.map((r: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-xs"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-zinc-300">{r.antecedents.join(' + ')}</span>
                <span className="text-gold-400">→</span>
                <span className="font-mono text-gold-200">{r.consequents.join(' + ')}</span>
                <span className="ml-auto chip">lift {r.lift.toFixed(2)}</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                support {r.support.toFixed(3)} · confidence {(r.confidence * 100).toFixed(1)}%
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel title="Beer + diapers, live">
        <p className="text-sm text-zinc-300 leading-relaxed">
          Apriori scans every multi-item basket and reports which items co-occur more than
          chance would predict. <strong className="text-gold-300">Lift &gt; 1</strong> means
          they're "sticky". Amazon's "frequently bought together" is this in fancy clothes.
        </p>
        <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
          Try dropping <code>min-support</code> - rarer patterns surface, at the cost of noise.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------ ANOMALY ------------------ */
function Anomaly() {
  const [contamination, setContamination] = useState(0.03);
  const [data, setData] = useState<any>(null);

  useEffect(() => { api.anomaly(contamination).then(setData); }, [contamination]);

  if (!data || data.error) return <Panel title="Anomaly"><p className="text-sm text-zinc-400">{data?.error ?? 'Loading…'}</p></Panel>;

  const { confusion } = data;
  const precision = confusion.true_fraud_flagged + confusion.false_positive > 0
    ? confusion.true_fraud_flagged / (confusion.true_fraud_flagged + confusion.false_positive)
    : 0;
  const recall = confusion.true_fraud_flagged + confusion.true_fraud_missed > 0
    ? confusion.true_fraud_flagged / (confusion.true_fraud_flagged + confusion.true_fraud_missed)
    : 0;

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
      <Panel
        title="Banking fraud · IsolationForest"
        subtitle="hour × amount · flagged in red, unflagged in grey"
        right={
          <label className="text-xs flex items-center gap-2">
            contamination
            <input type="range" min={1} max={10} value={Math.round(contamination * 100)}
              onChange={(e) => setContamination(+e.target.value / 100)}
              className="accent-gold-500" />
            <span className="font-mono text-gold-300 w-10 text-center">{(contamination * 100).toFixed(0)}%</span>
          </label>
        }
      >
        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" dataKey="hour" stroke="#71717a" tick={{ fontSize: 11 }} domain={[0, 24]} label={{ value: 'Hour', position: 'insideBottomRight', offset: -10, fill: '#71717a', fontSize: 11 }} />
              <YAxis type="number" dataKey="amount" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: 'Amount', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: 12 }} />
              <Scatter
                name="Normal"
                data={data.points.filter((p: any) => p.flagged === 0)}
                shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={2.5} fill="#52525b" fillOpacity={0.6} />}
              />
              <Scatter
                name="Flagged"
                data={data.points.filter((p: any) => p.flagged === 1)}
                shape={(props: any) => {
                  const isRealFraud = props.payload.is_fraud === 1;
                  return <circle cx={props.cx} cy={props.cy} r={5} fill={isRealFraud ? '#f87171' : '#f1b02c'} stroke="#fff" strokeOpacity={0.6} />;
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          Red circles: flagged AND actually fraudulent. Amber circles: flagged but actually legitimate (false positives).
        </p>
      </Panel>

      <Panel title="Confusion">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="True fraud caught" value={confusion.true_fraud_flagged} tone="emerald" />
          <Stat label="Fraud missed" value={confusion.true_fraud_missed} tone="rose" />
          <Stat label="False alarms" value={confusion.false_positive} tone="bronze" />
          <Stat label="True negatives" value={confusion.true_negative} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Precision" value={(precision * 100).toFixed(1) + '%'} tone="gold" />
          <Stat label="Recall" value={(recall * 100).toFixed(1) + '%'} tone="gold" />
        </div>
      </Panel>
    </div>
  );
}
