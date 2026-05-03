import { ReactNode } from 'react';
import { IconAlert, IconBolt, IconCheck, IconSparkle } from '../icons';

type Tone = 'default' | 'gold' | 'rose' | 'violet' | 'emerald';

const TONE_CLASS: Record<Tone, string> = {
  default: 'callout',
  gold: 'callout callout-gold',
  rose: 'callout callout-rose',
  violet: 'callout callout-violet',
  emerald: 'callout callout-emerald',
};

const ICON_TINT: Record<Tone, string> = {
  default: 'text-zinc-300',
  gold: 'text-gold-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  emerald: 'text-emerald-300',
};

export function Callout({
  tone = 'default',
  icon,
  title,
  children,
  className = '',
}: {
  tone?: Tone;
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const defaultIcon =
    tone === 'rose' ? <IconAlert size={18} /> :
    tone === 'gold' ? <IconSparkle size={18} /> :
    tone === 'violet' ? <IconBolt size={18} /> :
    tone === 'emerald' ? <IconCheck size={18} /> :
    <IconSparkle size={18} />;

  return (
    <aside className={`${TONE_CLASS[tone]} ${className}`}>
      <span className={`shrink-0 mt-0.5 ${ICON_TINT[tone]}`}>{icon ?? defaultIcon}</span>
      <div className="min-w-0">
        {title && <div className="text-sm font-semibold text-zinc-50 mb-0.5">{title}</div>}
        <div className="text-sm text-zinc-300 leading-relaxed">{children}</div>
      </div>
    </aside>
  );
}

export function StudentNote({ children, title = 'For students' }: { title?: string; children: ReactNode }) {
  return (
    <Callout tone="violet" title={title}>
      {children}
    </Callout>
  );
}

export function TryThis({ children }: { children: ReactNode }) {
  return (
    <Callout tone="gold" title="Try this">
      {children}
    </Callout>
  );
}

export function WarStory({ children, title = 'War story' }: { title?: string; children: ReactNode }) {
  return (
    <Callout tone="rose" title={title}>
      {children}
    </Callout>
  );
}
