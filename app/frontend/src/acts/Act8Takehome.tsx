import { useState } from 'react';
import { motion } from 'framer-motion';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { Link } from 'react-router-dom';
import { IconArrowRight } from '../icons';

const THINGS: { front: string; back: string; to?: string }[] = [
  { front: 'OLTP runs the business. OLAP understands it. Don\'t mix them.', back: 'See Act 2 — watch OLTP latency spike the moment an OLAP aggregate runs on it.', to: '/act/2' },
  { front: 'Start with a STAR schema. Everyone does. Everyone should.', back: 'See Act 4 — morph STAR → SNOWFLAKE → GALAXY and feel the joins multiply.', to: '/act/4' },
  { front: 'ELT replaced ETL because cloud compute got cheaper than transform servers.', back: 'See Act 5 — data loads raw into Bronze first; transforms happen inside the warehouse.', to: '/act/5' },
  { front: 'Bronze → Silver → Gold is the default mental model. Memorize it.', back: 'Act 5 is built around exactly this. Inject dirt, replay, inspect each layer.', to: '/act/5' },
  { front: '70% of a data scientist\'s job is cleaning data. Accept it early.', back: 'Act 5\'s DQ log shows what "cleaning" actually looks like: quarantine, log, replay.', to: '/act/5' },
  { front: 'Classification · Regression · Clustering · Association · Anomaly — pattern-match the problem.', back: 'Act 6 — five live demos, one per shape.', to: '/act/6' },
  { front: 'GenAI made data quality MORE important, not less. RAG without clean data is a liar.', back: 'The Gold layer in Act 5 is exactly what a RAG system should be grounded on.', to: '/act/5' },
  { front: 'Data quality is a religion, not a stage. Monitor schemas and distributions always.', back: 'The DQ log in Act 5 is the tiny version of Monte Carlo / Great Expectations / Soda.', to: '/act/5' },
  { front: 'Pick ONE cloud stack and go deep. T-shaped beats shallow-across-ten.', back: 'Every tool in the modern stack is a dialect of the ideas in Acts 4–7.' },
  { front: 'Build ONE end-to-end project. Ship it. The README matters more than the stack.', back: 'This app is that project. Fork it, rename the dataset, redeploy.' },
];

export default function Act8Takehome() {
  return (
    <div>
      <ActHeader
        actNumber="08"
        eyebrow="The take-home"
        slideRef="30"
        title="Ten things. Click to flip."
        subtitle="The slide-30 take-aways, rebuilt as cards that link back into the app. If one sticks, this whole tour was worth it."
      />

      <div className="grid sm:grid-cols-2 gap-4">
        {THINGS.map((t, i) => (
          <FlipCard key={i} n={i + 1} front={t.front} back={t.back} to={t.to} delay={i * 0.04} />
        ))}
      </div>

      <Panel className="mt-8" title="One more thing (slide 31)" subtitle="The tools will change. The patterns won't.">
        <p className="text-sm text-zinc-300 leading-relaxed">
          In five years half the tool names in this app will be gone, replaced by better ones.
          But <span className="text-gold-300">OLTP vs OLAP</span>,{' '}
          <span className="text-gold-300">facts vs dimensions</span>,{' '}
          <span className="text-gold-300">batch vs streaming</span>, and{' '}
          <span className="text-gold-300">Bronze vs Gold</span> — those are forever.
          Learn the patterns. The tools are just the accent.
        </p>
      </Panel>
    </div>
  );
}

function FlipCard({ n, front, back, to, delay }: { n: number; front: string; back: string; to?: string; delay: number }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative h-[200px] cursor-pointer [perspective:1200px]"
      onClick={() => setFlipped((f) => !f)}
    >
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <Face className="panel p-5 flex flex-col" side="front">
          <span className="text-[11px] uppercase tracking-[0.2em] text-gold-300 font-mono">{String(n).padStart(2, '0')}</span>
          <span className="mt-3 font-display text-xl text-zinc-50 leading-snug">{front}</span>
          <span className="mt-auto text-[11px] text-zinc-500">click to flip</span>
        </Face>
        <Face className="panel p-5 flex flex-col bg-gold-600/10 border-gold-600/30" side="back">
          <span className="text-[11px] uppercase tracking-[0.2em] text-gold-300 font-mono">{String(n).padStart(2, '0')}</span>
          <span className="mt-3 text-sm text-zinc-200 leading-relaxed">{back}</span>
          {to && (
            <Link
              to={to}
              onClick={(e) => e.stopPropagation()}
              className="mt-auto inline-flex items-center gap-1 text-xs text-gold-300 hover:text-gold-200"
            >
              Go there <IconArrowRight size={12} />
            </Link>
          )}
        </Face>
      </motion.div>
    </motion.div>
  );
}

function Face({ className, children, side }: { className: string; children: React.ReactNode; side: 'front' | 'back' }) {
  return (
    <div
      className={`absolute inset-0 [backface-visibility:hidden] ${className}`}
      style={{ transform: side === 'back' ? 'rotateY(180deg)' : undefined }}
    >
      {children}
    </div>
  );
}
