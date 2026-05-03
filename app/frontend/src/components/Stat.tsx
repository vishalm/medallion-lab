import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  className = '',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'gold' | 'bronze' | 'silver' | 'emerald' | 'rose' | 'violet';
  icon?: ReactNode;
  className?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: 'text-zinc-50',
    gold: 'text-gold-300',
    bronze: 'text-bronze-300',
    silver: 'text-silver-300',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
    violet: 'text-violet-300',
  };
  const glow: Record<string, string> = {
    default: '',
    gold: 'shadow-[0_0_40px_-15px_rgba(241,176,44,0.6)]',
    bronze: 'shadow-[0_0_40px_-15px_rgba(176,123,58,0.6)]',
    silver: 'shadow-[0_0_40px_-15px_rgba(147,160,172,0.5)]',
    emerald: 'shadow-[0_0_40px_-15px_rgba(16,185,129,0.55)]',
    rose: 'shadow-[0_0_40px_-15px_rgba(244,63,94,0.55)]',
    violet: 'shadow-[0_0_40px_-15px_rgba(139,92,246,0.55)]',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`panel p-4 relative overflow-hidden ${glow[tone]} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-zinc-400">{label}</span>
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
      <div className={`mt-2 font-display text-3xl tabular-nums ${toneClasses[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </motion.div>
  );
}
