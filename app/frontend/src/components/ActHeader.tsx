import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function ActHeader({
  actNumber,
  eyebrow,
  title,
  subtitle,
  slideRef,
  children,
}: {
  actNumber: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  slideRef?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 relative">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-zinc-400 uppercase tracking-[0.25em]"
      >
        <span className="text-gold-300 font-mono">ACT {actNumber}</span>
        <span className="text-zinc-700">·</span>
        <span>{eyebrow}</span>
        {slideRef && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">Deck: {slideRef}</span>
          </>
        )}
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-3 font-display text-4xl sm:text-5xl tracking-tight text-zinc-50 leading-[1.05]"
      >
        {title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-3 max-w-3xl text-zinc-300 leading-relaxed"
      >
        {subtitle}
      </motion.p>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}
