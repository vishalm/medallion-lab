import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hero } from '../components/Hero';
import { DataFlowIllustration } from '../components/DataFlowIllustration';
import { Callout } from '../components/Callout';
import {
  IconArrowRight, IconBolt, IconBookmark, IconBrain, IconCoin, IconCube,
  IconDatabase, IconFlow, IconGlobe, IconSparkle, IconStar, IconTerminal,
} from '../icons';

type TourItem = {
  n: string; to: string; t: string; s: string;
  slide: string;
  Icon: (p: any) => JSX.Element;
  color: string;
  hero?: boolean;
  badge?: string;
};

const HERO_ACTS: TourItem[] = [
  {
    n: '05', to: '/act/5', t: 'Medallion Pipeline',
    s: 'Bronze → Silver → Gold with live dirty-data injectors. The lecture’s anchor diagram, made interactive.',
    slide: 'Slides 14–18, 24', Icon: IconFlow, color: 'gold', hero: true,
    badge: 'Lecture hero',
  },
  {
    n: '09', to: '/act/9', t: 'CFO Finance Lab',
    s: 'One CFO storyline, five stages - MESS · TRUST · DECIDE · PREDICT · ASK - ending in text-to-SQL chat over a local LLM.',
    slide: 'Demo hero · with AI', Icon: IconCoin, color: 'gold', hero: true,
    badge: 'New · with AI',
  },
];

const TOUR: TourItem[] = [
  { n: '01', to: '/act/1', t: 'The Landscape',            s: 'Why every company is now a data company',                  slide: 'Slides 4–6',   Icon: IconGlobe,    color: 'violet' },
  { n: '02', to: '/act/2', t: 'OLTP vs OLAP',             s: 'Live: the 11-a.m. intern-crashed-the-bank query',          slide: 'Slides 7–9',   Icon: IconDatabase, color: 'rose' },
  { n: '03', to: '/act/3', t: 'The Cube',                 s: 'Slice · Dice · Drill · Roll-up · Pivot - live on Gold',    slide: 'Slide 9',      Icon: IconCube,     color: 'violet' },
  { n: '04', to: '/act/4', t: 'Star · Snowflake · Galaxy', s: 'Morph three schemas; ROLAP vs MOLAP vs HOLAP',            slide: 'Slides 10–13', Icon: IconStar,     color: 'silver' },
  { n: '06', to: '/act/6', t: 'Mining → AI',              s: 'Five live mini-models: classification, regression, clustering, association, anomaly', slide: 'Slides 20–23', Icon: IconBrain, color: 'emerald' },
  { n: '07', to: '/act/7', t: 'SQL Playground',           s: 'Query Bronze / Silver / Gold side-by-side in your browser', slide: 'Bonus',       Icon: IconTerminal, color: 'default' },
  { n: '08', to: '/act/8', t: 'Take-home',                s: 'Ten things · flip a card, see it proven in the app',       slide: 'Slide 30',     Icon: IconBookmark, color: 'bronze' },
];

const HIGHLIGHTS = [
  { n: '9',   l: 'Interactive acts',  d: 'each one click-able, replayable' },
  { n: '5',   l: 'Live AI panels',    d: 'mining + anomaly + forecast + concentration + chat' },
  { n: '5k+', l: 'Synthetic rows',    d: 'retail · banking · telecom · finance' },
  { n: '∞',   l: 'Plain-English Qs',  d: 'the LLM writes the SQL for you' },
];

const ROLES = [
  { title: 'Data Engineer',       sub: 'the plumber',     body: 'Builds the pipes. Moves data. Fixes it at 2am.',          pay: '₹8–25L · $25–75K',  acts: 'Act 5' },
  { title: 'Analytics Engineer',  sub: 'the translator',  body: 'Turns raw data into trusted business metrics.',           pay: '₹10–28L · $30–90K', acts: 'Act 5 · 9' },
  { title: 'Data Analyst / BI',   sub: 'the storyteller', body: 'Talks to business. Builds dashboards. Asks "why".',       pay: '₹6–18L · $20–60K',  acts: 'Act 7 · 9' },
  { title: 'Data Scientist',      sub: 'the detective',   body: 'Statistical models, A/B tests, forecasting.',             pay: '₹12–35L · $40–110K', acts: 'Act 6 · 9' },
  { title: 'ML / AI Engineer',    sub: 'the operator',    body: 'Ships models to prod. Tunes LLMs. Fights drift.',         pay: '₹15–50L · $60–180K', acts: 'Act 9' },
  { title: 'Data Architect',      sub: "the CTO's CTO",   body: 'Designs the whole house. The one the CTO calls.',         pay: '₹25–70L · $100–250K', acts: 'Act 4 · 5' },
];

export default function Overview() {
  return (
    <div>
      <Hero
        eyebrow={<>
          <span className="text-gold-300">Welcome to</span>
          <span className="t-5">·</span>
          <span className="t-3">Medallion Lab</span>
          <span className="t-5">·</span>
          <span className="t-3">CSIT341 · hands-on</span>
        </>}
        title={<>The <span className="shimmer-text">Medallion</span> playground for Data &amp; AI.</>}
        subtitle={<>
          A live, in-browser walk-through of how a data warehouse actually works -
          from messy CSVs through Bronze → Silver → Gold, into BI dashboards, anomaly
          detection, and a CFO chat panel that answers plain-English questions over
          your data using a <strong>local LLM</strong>. Click anything. Break it. Reset. Repeat.
        </>}
        actions={
          <>
            <Link to="/act/9" className="btn-gold">
              <IconSparkle size={16} /> Try the AI · Act 9
              <IconArrowRight size={14} />
            </Link>
            <Link to="/act/5" className="btn">
              <IconBolt size={16} /> Medallion hero · Act 5
            </Link>
            <Link to="/act/1" className="btn btn-ghost">
              Start from Act 1 <IconArrowRight size={14} />
            </Link>
          </>
        }
        illustration={<DataFlowIllustration />}
      />

      {/* highlights strip - fast visual proof of breadth */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {HIGHLIGHTS.map((h, i) => (
          <motion.div
            key={h.l}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="panel p-4 relative overflow-hidden"
          >
            <div
              className="absolute -right-6 -top-6 w-20 h-20 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(241,176,44,0.22), transparent 65%)' }}
            />
            <div className="font-display text-3xl tabular-nums" style={{ color: 'var(--accent-strong)' }}>{h.n}</div>
            <div className="text-[11px] uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-3)' }}>{h.l}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{h.d}</div>
          </motion.div>
        ))}
      </section>

      {/* Hero acts - Medallion + CFO Lab side by side */}
      <section className="mb-10">
        <SectionHeading
          eyebrow="Where to start"
          title={<>Two <span className="shimmer-text">heroes</span>. Pick either.</>}
          tail="click a card"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          {HERO_ACTS.map((item, i) => (
            <motion.div
              key={item.n}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.32 }}
            >
              <Link
                to={item.to}
                className="block panel panel-hover p-6 transition group relative overflow-hidden ring-1 ring-gold-500/40
                           shadow-[0_0_70px_-20px_rgba(241,176,44,0.55)]"
              >
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gold-500/20 blur-3xl pointer-events-none" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={colorText(item.color)}><item.Icon size={26} /></span>
                    <span className="text-xs font-mono t-4 tracking-widest">ACT {item.n}</span>
                  </div>
                  {item.badge && <span className="chip chip-gold">{item.badge}</span>}
                </div>
                <h3 className="relative mt-4 font-display text-2xl t-1 group-hover:text-gold-100 transition">
                  {item.t}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>{item.s}</p>
                <div className="relative mt-4 flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
                  <IconArrowRight size={14} />
                  Open Act {item.n}
                </div>
                <div className="relative mt-1 text-[10px] font-mono t-5">{item.slide}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* The rest of the acts */}
      <section className="mb-10">
        <SectionHeading
          eyebrow="The rest of the tour"
          title={<>Seven more <span className="shimmer-text">acts</span>.</>}
          tail="press 0–9 anywhere"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOUR.map((item, i) => (
            <motion.div
              key={item.n}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.025 * i }}
            >
              <Link
                to={item.to}
                className="block panel panel-hover p-4 transition group relative overflow-hidden h-full"
              >
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={colorText(item.color)}><item.Icon size={18} /></span>
                    <span className="text-[10px] font-mono t-4 tracking-widest">ACT {item.n}</span>
                  </div>
                  <span className="text-[10px] t-5 font-mono">{item.slide}</span>
                </div>
                <h3 className="relative mt-2 font-display text-base t-1 group-hover:text-gold-100 transition">
                  {item.t}
                </h3>
                <p className="relative mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{item.s}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="mb-10">
        <SectionHeading
          eyebrow="Slide 6 · where CS grads land"
          title={<>Six roles. <span className="shimmer-text">One ecosystem</span>.</>}
        />
        <p className="text-sm mb-5 max-w-3xl" style={{ color: 'var(--text-3)' }}>
          You'll touch at least three of these in your first three years. Each role lives
          inside specific acts - engineers in Act 5, analysts in Act 7 + 9, scientists
          in Act 6, AI engineers in Act 9.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.025 * i }}
              className="panel p-5 relative group overflow-hidden"
            >
              <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-gold-400/5 blur-2xl group-hover:bg-gold-400/10 transition" />
              <div className="relative flex items-baseline gap-2">
                <h3 className="font-display text-lg t-1">{r.title}</h3>
                <span className="text-[11px] italic t-4">"{r.sub}"</span>
              </div>
              <p className="relative mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{r.body}</p>
              <div className="relative mt-4 pt-3 border-t flex items-baseline justify-between gap-2 text-[11px] font-mono"
                   style={{ borderColor: 'var(--glass-border)', color: 'var(--text-3)' }}>
                <span>{r.pay}</span>
                <span className="chip chip-gold">{r.acts}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <Callout tone="gold" title="How to read Medallion Lab">
        <ul className="mt-1 space-y-1.5 list-disc list-inside marker:text-gold-400">
          <li>Data is fully synthetic and re-seeded on demand. Press <span className="kbd">R</span> in any act to reset.</li>
          <li>Every act shows the real SQL or Python - read the code, then press the button.</li>
          <li>Act 5 is the lecture's anchor. Act 9 is the live demo's wow moment.</li>
          <li>The floating chat (bottom-right) works on every page - ask the data anything.</li>
        </ul>
      </Callout>
    </div>
  );
}

function SectionHeading({
  eyebrow, title, tail,
}: {
  eyebrow: string;
  title: React.ReactNode;
  tail?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em]" style={{ color: 'var(--text-3)' }}>
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-2xl sm:text-3xl t-1">{title}</h2>
      </div>
      {tail && <span className="text-xs t-4">{tail}</span>}
    </div>
  );
}

function colorText(c: string): string {
  return {
    gold:    'text-gold-300',
    bronze:  'text-bronze-300',
    silver:  'text-silver-300',
    rose:    'text-rose-300',
    emerald: 'text-emerald-300',
    violet:  'text-violet-300',
    default: 'text-zinc-300',
  }[c] ?? 'text-zinc-300';
}
