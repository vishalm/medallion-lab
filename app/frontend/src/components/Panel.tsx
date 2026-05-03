import { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
  tone = 'default',
  pad = true,
}: {
  title?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'gold' | 'bronze' | 'silver' | 'rose' | 'violet';
  pad?: boolean;
}) {
  const toneClass = {
    default: '',
    gold: 'glass-tinted glass-gold',
    bronze: 'glass-tinted glass-bronze',
    silver: 'glass-tinted glass-silver',
    rose: 'glass-tinted glass-rose',
    violet: 'glass-tinted glass-violet',
  }[tone];

  return (
    <section className={`panel ${toneClass} ${className}`}>
      {(title || right) && (
        <header className="relative flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-white/5">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-wide text-zinc-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>}
          </div>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={pad ? 'p-5 relative' : 'relative'}>{children}</div>
    </section>
  );
}
