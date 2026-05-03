import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { IconCheck } from '../icons';

export interface Step {
  title: string;
  body: ReactNode;
  kbd?: string;
}

export function StepGuide({
  steps,
  currentIndex,
  onPick,
  className = '',
}: {
  steps: Step[];
  currentIndex: number;
  onPick?: (i: number) => void;
  className?: string;
}) {
  return (
    <ol className={`space-y-2 ${className}`}>
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl p-3 flex gap-3 cursor-pointer transition
              ${active
                ? 'bg-gold-600/15 border border-gold-500/40 shadow-[0_0_30px_-10px_rgba(241,176,44,0.5)]'
                : done
                  ? 'bg-emerald-900/20 border border-emerald-700/30'
                  : 'bg-white/3 border border-white/5 hover:bg-white/5'}`}
            onClick={() => onPick?.(i)}
          >
            <div
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono
                ${active
                  ? 'bg-gold-500 text-zinc-950'
                  : done
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'bg-white/10 text-zinc-400'}`}
            >
              {done ? <IconCheck size={14} /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className={`text-sm font-medium ${active ? 'text-gold-100' : 'text-zinc-100'}`}>
                  {s.title}
                </div>
                {s.kbd && <span className="kbd">{s.kbd}</span>}
              </div>
              <div className="mt-0.5 text-xs text-zinc-400 leading-relaxed">{s.body}</div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
