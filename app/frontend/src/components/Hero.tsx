import { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Hero({
  eyebrow,
  title,
  subtitle,
  illustration,
  actions,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  illustration?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl glass p-8 sm:p-10 lg:p-12 mb-10">
      <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-gold-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />
      <div className="relative grid lg:grid-cols-[1.3fr,1fr] gap-10 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.25em] text-zinc-400"
          >
            {eyebrow}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-zinc-50"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-5 max-w-2xl text-zinc-300 text-base leading-relaxed"
          >
            {subtitle}
          </motion.p>
          {actions && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-7 flex flex-wrap gap-3"
            >
              {actions}
            </motion.div>
          )}
        </div>
        {illustration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="relative"
          >
            {illustration}
          </motion.div>
        )}
      </div>
    </section>
  );
}
