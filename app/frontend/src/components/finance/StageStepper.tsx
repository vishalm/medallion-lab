import { motion } from 'framer-motion';

export type StageId = 'mess' | 'trust' | 'decide' | 'predict' | 'ask';

const STAGES: { id: StageId; label: string; verb: string; sub: string }[] = [
  { id: 'mess',    verb: 'MESS',    label: 'The mess',          sub: 'Two raw files. Different shapes.' },
  { id: 'trust',   verb: 'TRUST',   label: 'Make it trustable', sub: 'Bronze · Silver · Gold' },
  { id: 'decide',  verb: 'DECIDE',  label: 'BI dashboards',     sub: 'Spend by dept · top vendors' },
  { id: 'predict', verb: 'PREDICT', label: 'Anomalies',         sub: 'Find weird expenses' },
  { id: 'ask',     verb: 'ASK',     label: 'Conversational',    sub: 'Text → SQL → answer' },
];

export function StageStepper({
  active, onSelect,
}: {
  active: StageId;
  onSelect: (s: StageId) => void;
}) {
  return (
    <div className="overflow-x-auto scroll-thin -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
      <div
        className="grid gap-2 min-w-[640px] sm:min-w-0"
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
      >
        {STAGES.map((s, i) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`group relative rounded-xl px-3 py-3 text-left transition border
                ${isActive
                  ? 'border-gold-400/60 bg-gold-300/10'
                  : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15'}`}
            >
              <div className="flex items-baseline gap-2">
                <span className={`font-mono text-[10px] tracking-widest ${isActive ? 'text-gold-300' : 'text-zinc-500'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={`font-display text-sm tracking-wide ${isActive ? 'text-gold-200' : 'text-zinc-200 group-hover:text-zinc-50'}`}>
                  {s.verb}
                </span>
              </div>
              <div className={`mt-1 text-xs ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>{s.label}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500 leading-tight hidden sm:block">{s.sub}</div>
              {isActive && (
                <motion.div
                  layoutId="stage-underline"
                  className="absolute -bottom-px left-3 right-3 h-px bg-gradient-to-r from-transparent via-gold-300 to-transparent"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const STAGE_LIST = STAGES;
