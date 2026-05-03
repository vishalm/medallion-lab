import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { DataTable } from '../components/DataTable';
import { StepGuide, Step } from '../components/StepGuide';
import { Callout, StudentNote, WarStory } from '../components/Callout';
import { api } from '../lib/api';
import { fmtNum } from '../lib/format';
import {
  IconAlert, IconBolt, IconCheck, IconPlay, IconRefresh, IconSparkle,
} from '../icons';

type Layer = 'bronze' | 'silver' | 'gold_fact';
type InjectKind = 'drift' | 'dupes' | 'nulls';
type Industry = 'retail' | 'banking' | 'telecom';

const INDUSTRIES: { key: Industry; label: string; hint: string; ravi: string }[] = [
  { key: 'retail',  label: 'Retail',  hint: 'Ravi @ Dubai Mall buys 2 iPhones', ravi: 'Customer · Product · Store · Date · Channel' },
  { key: 'banking', label: 'Banking', hint: 'Fraud hides in unknown-overseas ATMs at 02:00', ravi: 'Account · Merchant · Amount · Time · Geo' },
  { key: 'telecom', label: 'Telecom', hint: 'Dropped calls predict churn 90 days out', ravi: 'Subscriber · Duration · Data MB · Dropped · Time' },
];

const STEPS: Step[] = [
  { title: 'Start here', body: 'You land on the tour with a clean, seeded warehouse. Bronze, Silver, Gold all in sync.', kbd: 'R' },
  { title: 'Inject dirty data into Bronze', body: 'Upstream teams break things. Pick schema drift, a dupe flood, or a null flood.', kbd: 'D' },
  { title: 'Replay the pipeline', body: 'Watch the packets flow again. The validator in Silver catches the bad rows and logs a DQ event.', kbd: 'Space' },
  { title: 'Inspect each layer', body: 'Click Bronze, Silver, or Gold above the table to see what each layer actually holds.', kbd: '1/2/3' },
  { title: 'Read the quality log', body: 'Every caught issue shows up on the right. That is your production monitor, minimal edition.', kbd: 'Q' },
];

export default function Act5Medallion() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dq, setDq] = useState<any[]>([]);
  const [activeLayer, setActiveLayer] = useState<Layer>('bronze');
  const [layerSample, setLayerSample] = useState<any[]>([]);
  const [flash, setFlash] = useState<{ kind: InjectKind; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<Industry>('retail');
  const [narrating, setNarrating] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [lastReplay, setLastReplay] = useState<any>(null);
  const narrateTimers = useRef<number[]>([]);
  const [streaming, setStreaming] = useState(false);
  const streamTimer = useRef<number | null>(null);

  const refresh = async () => {
    const [c, e] = await Promise.all([api.layerCounts(), api.dqEvents()]);
    setCounts(c);
    setDq(e.events);
  };

  const loadSample = async (layer: Layer) => {
    setActiveLayer(layer);
    const r = await api.sampleLayer(layer, 25);
    setLayerSample(r.rows);
  };

  useEffect(() => { refresh().then(() => loadSample('bronze')); }, []);

  // Clean narrate + stream timers on unmount
  useEffect(() => () => {
    narrateTimers.current.forEach(clearTimeout);
    if (streamTimer.current) clearInterval(streamTimer.current);
  }, []);

  // Streaming ingest: every 1.2s, push a valid row into Bronze
  useEffect(() => {
    if (!streaming) {
      if (streamTimer.current) { clearInterval(streamTimer.current); streamTimer.current = null; }
      return;
    }
    const tick = async () => {
      try {
        await api.streamTick(1);
        const c = await api.layerCounts();
        setCounts(c);
      } catch {
        // swallow transient errors
      }
    };
    tick();
    streamTimer.current = window.setInterval(tick, 1200);
    return () => { if (streamTimer.current) clearInterval(streamTimer.current); };
  }, [streaming]);

  const inject = async (kind: InjectKind) => {
    setBusy(true);
    try {
      const r = await api.inject(kind);
      setFlash({ kind, n: r.injected });
      setStep(Math.max(step, 2));
      await refresh();
      if (activeLayer === 'bronze') await loadSample('bronze');
      setTimeout(() => setFlash(null), 3000);
    } finally { setBusy(false); }
  };

  const replay = async () => {
    setBusy(true);
    try {
      const r = await api.replay();
      setLastReplay(r);
      setStep(Math.max(step, 3));
      await refresh();
      await loadSample(activeLayer);
    } finally { setBusy(false); }
  };

  const fullReset = async () => {
    setBusy(true);
    try {
      await api.reset();
      setStep(0);
      setLastReplay(null);
      await refresh();
      await loadSample('bronze');
      setActiveLayer('bronze');
    } finally { setBusy(false); }
  };

  const startNarrate = async () => {
    if (narrating) return;
    setNarrating(true);
    narrateTimers.current.forEach(clearTimeout);
    narrateTimers.current = [];
    const queue: { caption: string; delay: number; action?: () => Promise<void> | void }[] = [
      { caption: 'Start with a clean warehouse. Bronze has raw rows; Silver and Gold mirror it.', delay: 0 },
      { caption: "Here's Act 5's trick: we'll break Bronze on purpose.", delay: 3800 },
      { caption: 'Schema drift — upstream renamed a column. Injecting 30 bad rows.', delay: 7000,
        action: async () => { await api.inject('drift'); await refresh(); } },
      { caption: 'Now the null flood — a CRM feed forgot customer_id.', delay: 10500,
        action: async () => { await api.inject('nulls'); await refresh(); } },
      { caption: 'Replaying the pipeline. Watch Silver catch every issue…', delay: 14000,
        action: async () => { const r = await api.replay(); setLastReplay(r); await refresh(); setStep(3); } },
      { caption: 'Silver stays clean, Gold unchanged, DQ log fills on the right.', delay: 18500,
        action: async () => { await loadSample('silver'); setActiveLayer('silver'); } },
      { caption: 'That is Medallion in one breath: raw → clean → trusted, with a loud failure mode.', delay: 22500 },
      { caption: null as any, delay: 27000, action: () => { setCaption(null); setNarrating(false); } },
    ];
    queue.forEach((q) => {
      const id = window.setTimeout(async () => {
        if (q.caption !== null) setCaption(q.caption);
        if (q.action) await q.action();
      }, q.delay);
      narrateTimers.current.push(id);
    });
  };

  const stopNarrate = () => {
    narrateTimers.current.forEach(clearTimeout);
    narrateTimers.current = [];
    setCaption(null);
    setNarrating(false);
  };

  // Keyboard shortcuts local to this page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); replay(); }
      else if (e.key.toLowerCase() === 'r') fullReset();
      else if (e.key.toLowerCase() === 'd') inject('drift');
      else if (e.key.toLowerCase() === 'n') inject('nulls');
      else if (e.key.toLowerCase() === 'u') inject('dupes');
      else if (e.key.toLowerCase() === 'q') document.getElementById('dq-log')?.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // deps omitted deliberately; actions read latest via closures of these refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeLayer]);

  return (
    <div>
      <ActHeader
        actNumber="05"
        eyebrow="The Hero · Modern Stack"
        slideRef="14–18, 24"
        title="Bronze → Silver → Gold."
        subtitle="If you remember one diagram from the lecture, let it be this one. Every modern platform — Databricks, Snowflake, Fabric, BigQuery — is a dialect of Bronze-Silver-Gold. Inject dirty data from the slide-24 war stories and watch the pipeline catch it."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => inject('drift')} disabled={busy || narrating} className="btn-danger">
            <IconAlert size={14} /> Schema drift <span className="kbd">D</span>
          </button>
          <button onClick={() => inject('dupes')} disabled={busy || narrating} className="btn-danger">
            <IconAlert size={14} /> Dupe flood <span className="kbd">U</span>
          </button>
          <button onClick={() => inject('nulls')} disabled={busy || narrating} className="btn-danger">
            <IconAlert size={14} /> Null flood <span className="kbd">N</span>
          </button>
          <button onClick={replay} disabled={busy || narrating} className="btn-gold">
            <IconPlay size={14} /> Replay <span className="kbd">Space</span>
          </button>
          <button onClick={fullReset} disabled={busy || narrating} className="btn">
            <IconRefresh size={14} /> Reset <span className="kbd">R</span>
          </button>
          <span className="mx-2 w-px h-6 bg-white/10" />
          <button
            onClick={() => setStreaming((s) => !s)}
            disabled={busy || narrating}
            className={streaming ? 'btn-gold' : 'btn'}
          >
            <span className={streaming ? 'animate-pulseDot text-emerald-300' : 'text-zinc-400'}>
              <IconBolt size={14} />
            </span>
            {streaming ? 'Streaming · on' : 'Streaming · off'}
          </button>
          {narrating ? (
            <button onClick={stopNarrate} className="btn-ghost">Stop narration</button>
          ) : (
            <button onClick={startNarrate} className="btn">
              <IconSparkle size={14} /> Narrate this act
            </button>
          )}
        </div>
      </ActHeader>

      <AnimatePresence>
        {streaming && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 callout callout-emerald text-sm"
          >
            <span className="shrink-0 mt-0.5 text-emerald-300"><IconBolt size={18} /></span>
            <div>
              <div className="font-medium text-emerald-100">Stream mode on</div>
              <div className="text-zinc-300">
                A clean POS row hits Bronze every 1.2 seconds. The counter above climbs live.
                Hit <strong>Replay</strong> anytime to push the new rows through Silver and Gold.
                This is what "it runs 24/7" actually looks like.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Industry switcher */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mr-2">Story of the data</span>
        {INDUSTRIES.map((i) => (
          <button
            key={i.key}
            onClick={() => setIndustry(i.key)}
            className={`btn text-xs ${industry === i.key ? 'btn-gold' : ''}`}
          >
            {i.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-zinc-400 italic">{INDUSTRIES.find(i => i.key === industry)!.hint}</span>
      </div>

      <PipelineVisual
        bronze={counts.bronze ?? 0}
        silver={counts.silver ?? 0}
        gold={counts.gold_fact ?? 0}
        active={activeLayer}
        onPickLayer={(L) => { loadSample(L); setStep(Math.max(step, 4)); }}
        injected={flash}
        caption={caption}
      />

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <Stat label="Bronze rows" value={fmtNum(counts.bronze ?? 0)} tone="bronze" hint="Raw ingested payloads" />
        <Stat label="Silver rows" value={fmtNum(counts.silver ?? 0)} tone="silver" hint="Typed · validated · deduped" />
        <Stat label="Gold fact rows" value={fmtNum(counts.gold_fact ?? 0)} tone="gold" hint={`${fmtNum(counts.gold_dim_customer ?? 0)} customers · ${fmtNum(counts.gold_dim_product ?? 0)} products`} />
      </div>

      <div className="grid lg:grid-cols-[1fr,1fr] gap-6 mt-6">
        <StudentNote title="Try it in 90 seconds">
          <ol className="mt-2 space-y-1 list-decimal list-inside marker:text-violet-300">
            <li>Press <span className="kbd">D</span> (drift) → <span className="kbd">N</span> (nulls) to pollute Bronze.</li>
            <li>Press <span className="kbd">Space</span> to replay. Silver won't grow — the bad rows are caught.</li>
            <li>Click <strong>Silver</strong> on the table selector to inspect it.</li>
            <li>Scroll to the <strong>Data-quality events</strong> panel — each injection produced a row.</li>
          </ol>
        </StudentNote>

        <WarStory title={`Slide 24 lives here`}>
          Schema drift, silent duplicates, and null floods are the three ways production pipelines fail
          quietly. You're about to trip every one of them — safely — and watch the validator win.
        </WarStory>
      </div>

      <div className="grid lg:grid-cols-[1fr,2fr] gap-6 mt-6">
        <Panel title="Step-by-step" subtitle="click a step to mark it done">
          <StepGuide steps={STEPS} currentIndex={step} onPick={(i) => setStep(i)} />
        </Panel>

        <Panel
          title={`Sample of ${layerLabel(activeLayer)}`}
          subtitle="Same rows, three levels of polish. Pick a layer to inspect."
          right={
            <div className="flex gap-1">
              {(['bronze', 'silver', 'gold_fact'] as Layer[]).map((L) => (
                <button
                  key={L}
                  onClick={() => loadSample(L)}
                  className={`btn text-xs ${activeLayer === L ? layerBtn(L) : ''}`}
                >
                  {layerLabel(L)}
                </button>
              ))}
            </div>
          }
        >
          <DataTable rows={layerSample} maxHeight={420} />
        </Panel>
      </div>

      <AnimatePresence>
        {lastReplay && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6"
          >
            <Panel title="Last replay · what the validator caught" subtitle="caught > missed — the religion of data quality" tone="gold">
              <div className="grid sm:grid-cols-4 gap-3">
                <Stat label="Parsed OK" value={lastReplay.silver.parsed_ok} tone="emerald" />
                <Stat label="Schema drift dropped" value={lastReplay.silver.dropped_schema} tone="rose" />
                <Stat label="Null keys quarantined" value={lastReplay.silver.quarantined_nulls} tone="rose" />
                <Stat label="Duplicates quarantined" value={lastReplay.silver.quarantined_dupes} tone="rose" />
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6" id="dq-log">
        <Panel
          title="Data-quality events"
          subtitle="Every caught issue, newest first"
          right={
            <span className="chip chip-emerald">
              <IconCheck size={12} /> {dq.length} recorded
            </span>
          }
        >
          {dq.length === 0 ? (
            <div className="text-xs text-zinc-500 py-6 text-center">
              No quality events yet. Inject one (<span className="kbd">D</span>, <span className="kbd">N</span>, <span className="kbd">U</span>) and replay (<span className="kbd">Space</span>).
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[440px] overflow-auto scroll-thin pr-1">
              <AnimatePresence initial={false}>
                {dq.map((e, i) => (
                  <motion.div
                    key={`${e.created_at}-${i}-${e.kind}`}
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl border border-rose-700/20 bg-rose-950/20 px-3 py-2.5 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                      <span>{e.layer}</span>
                      <span>{e.created_at?.replace('T', ' ')}</span>
                    </div>
                    <div className="mt-1 text-sm text-rose-200 font-medium">{e.kind.replace('_', ' ')}</div>
                    <div className="text-xs text-zinc-400">{e.detail}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      rows affected: <span className="text-zinc-300 font-mono">{e.rows_affected}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-6" title="Why this shape wins" subtitle="ELT, not ETL (slide 15)">
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-2xl p-5 glass glass-tinted glass-bronze">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl text-bronze-300">Bronze</div>
              <span className="chip chip-bronze">immutable</span>
            </div>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Raw. Source-shaped. We keep the original JSON so we can re-run anything.
              Zero business logic lives here — it's a landing pad.
            </p>
            <div className="mt-3 font-mono text-[11px] text-bronze-100/80">
              INSERT payload_json AS-IS
            </div>
          </div>
          <div className="rounded-2xl p-5 glass glass-tinted glass-silver">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl text-silver-300">Silver</div>
              <span className="chip chip-silver">validated</span>
            </div>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Typed. Schema-validated. Deduped. The place analysts start. Quarantine bad
              rows, log DQ events, move on. This is where "data quality" lives.
            </p>
            <div className="mt-3 font-mono text-[11px] text-silver-100/80">
              CAST · VALIDATE · DEDUP
            </div>
          </div>
          <div className="rounded-2xl p-5 glass glass-tinted glass-gold">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl text-gold-300">Gold</div>
              <span className="chip chip-gold">trusted</span>
            </div>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Business-shaped. Star schema. What dashboards, ML features, and the CFO
              all agree on. A single source of truth per subject area.
            </p>
            <div className="mt-3 font-mono text-[11px] text-gold-100/80">
              FACT + DIMS · STAR JOIN
            </div>
          </div>
        </div>
      </Panel>

      <Callout tone="violet" className="mt-6" title="The Ravi narrative">
        Slide 11 opens with <em>Ravi bought 2 iPhones on Tuesday at the Dubai Mall for AED 7,400</em>.
        In Bronze, that is a JSON blob from a POS terminal. In Silver, it's a typed row with a valid
        customer_id FK. In Gold, it's one row in <code>gold_fact_sales</code> plus references to
        <code>dim_customer</code>, <code>dim_product</code>, <code>dim_store</code>, <code>dim_date</code>
        — the exact shape a star schema was invented for. Try the layer selector above with
        that story in your head.
      </Callout>
    </div>
  );
}

function layerLabel(l: Layer): string {
  if (l === 'bronze') return 'Bronze';
  if (l === 'silver') return 'Silver';
  return 'Gold fact';
}

function layerBtn(l: Layer): string {
  if (l === 'bronze') return 'border-bronze-500/70 text-bronze-200 bg-bronze-600/20';
  if (l === 'silver') return 'border-silver-500/70 text-silver-100 bg-silver-500/20';
  return 'btn-gold';
}

function PipelineVisual({
  bronze, silver, gold, active, onPickLayer, injected, caption,
}: {
  bronze: number; silver: number; gold: number;
  active: Layer;
  onPickLayer: (l: Layer) => void;
  injected: { kind: InjectKind; n: number } | null;
  caption: string | null;
}) {
  return (
    <div className="panel p-6 relative overflow-hidden">
      <div className="absolute inset-0 grid-glow opacity-25 pointer-events-none" />
      <svg viewBox="0 0 900 260" className="relative w-full h-[260px]">
        <defs>
          <linearGradient id="bzToSv" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b07b3a" />
            <stop offset="100%" stopColor="#93a0ac" />
          </linearGradient>
          <linearGradient id="svToGd" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#93a0ac" />
            <stop offset="100%" stopColor="#f1b02c" />
          </linearGradient>
        </defs>

        <LayerNode x={40} y={100} w={120} label="Sources" sub="POS · CRM · mobile" tone="slate" />
        <FlowLine x1={160} x2={260} color="#52525b" />

        <LayerNode
          x={260} y={100} w={150} label="Bronze" sub={`${fmtNum(bronze)} raw rows`}
          tone="bronze" active={active === 'bronze'} onClick={() => onPickLayer('bronze')}
        />
        <FlowLine x1={410} x2={510} gradientId="bzToSv" />

        <LayerNode
          x={510} y={100} w={150} label="Silver" sub={`${fmtNum(silver)} typed rows`}
          tone="silver" active={active === 'silver'} onClick={() => onPickLayer('silver')}
        />
        <FlowLine x1={660} x2={760} gradientId="svToGd" />

        <LayerNode
          x={760} y={100} w={120} label="Gold" sub={`${fmtNum(gold)} fact rows`}
          tone="gold" active={active === 'gold_fact'} onClick={() => onPickLayer('gold_fact')}
        />

        <Particles fromX={180} toX={255} y={135} color="#b07b3a" count={6} />
        <Particles fromX={430} toX={505} y={135} color="#93a0ac" count={6} />
        <Particles fromX={680} toX={755} y={135} color="#f1b02c" count={6} />
      </svg>

      <AnimatePresence>
        {injected && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute right-5 top-5 rounded-xl px-3 py-2 bg-rose-900/60 border border-rose-600/60 text-rose-100 text-xs backdrop-blur flex items-center gap-2"
          >
            <IconAlert size={12} />
            Injected {injected.n} {injected.kind.replace('_', ' ')} rows into Bronze. Press <strong>Replay</strong>.
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {caption && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-6 bottom-4 rounded-xl px-4 py-3 glass glass-tinted glass-gold text-sm text-gold-50"
          >
            <span className="mr-2 inline-flex items-center gap-1 text-gold-300 text-[10px] uppercase tracking-widest"><IconSparkle size={12} /> narrating</span>
            {caption}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 text-xs text-zinc-500 flex items-center gap-2">
        <IconSparkle size={12} className="text-gold-300" />
        Click any layer above to inspect real rows. Inject dirt; press Replay. The quality log updates live.
      </div>
    </div>
  );
}

function LayerNode({
  x, y, w, label, sub, tone, active, onClick,
}: {
  x: number; y: number; w: number; label: string; sub: string;
  tone: 'bronze' | 'silver' | 'gold' | 'slate';
  active?: boolean; onClick?: () => void;
}) {
  const tones = {
    bronze: { fill: 'rgba(176,123,58,0.18)', stroke: '#b07b3a', text: '#f1dfc3' },
    silver: { fill: 'rgba(147,160,172,0.15)', stroke: '#93a0ac', text: '#eff2f5' },
    gold: { fill: 'rgba(241,176,44,0.22)', stroke: '#f1b02c', text: '#fff4c8' },
    slate: { fill: 'rgba(63,63,70,0.35)', stroke: '#52525b', text: '#d4d4d8' },
  }[tone];

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <motion.rect
        x={x} y={y} width={w} height={70} rx={18}
        fill={tones.fill}
        stroke={tones.stroke}
        strokeWidth={active ? 2.5 : 1.3}
        initial={false}
        animate={{ filter: active ? `drop-shadow(0 0 12px ${tones.stroke}aa)` : 'none' }}
      />
      {active && (
        <motion.rect
          x={x - 4} y={y - 4} width={w + 8} height={78} rx={22}
          fill="none" stroke={tones.stroke} strokeWidth={1}
          strokeDasharray="3 6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
        />
      )}
      <text x={x + w / 2} y={y + 28} textAnchor="middle" fill={tones.text} fontSize="16" fontWeight="600" fontFamily="Fraunces, serif">{label}</text>
      <text x={x + w / 2} y={y + 50} textAnchor="middle" fill={tones.text} fontSize="11" opacity={0.75} fontFamily="monospace">{sub}</text>
    </g>
  );
}

function FlowLine({ x1, x2, color, gradientId }: { x1: number; x2: number; color?: string; gradientId?: string }) {
  return (
    <line
      x1={x1} y1={135} x2={x2} y2={135}
      stroke={gradientId ? `url(#${gradientId})` : color}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

function Particles({ fromX, toX, y, color, count }: { fromX: number; toX: number; y: number; color: string; count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.circle
          key={i}
          cx={fromX}
          cy={y}
          r={3}
          fill={color}
          initial={{ opacity: 0 }}
          animate={{ cx: [fromX, toX], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.8, delay: (i * 1.8) / count, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </>
  );
}
