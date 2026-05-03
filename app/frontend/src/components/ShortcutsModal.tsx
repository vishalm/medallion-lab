import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconCross, IconSparkle } from '../icons';

interface ShortcutRow { keys: string[]; label: string; scope?: string }

const GLOBAL: ShortcutRow[] = [
  { keys: ['0'], label: 'Go to Overview', scope: 'Anywhere' },
  { keys: ['1'], label: 'Act 1 · Landscape', scope: 'Anywhere' },
  { keys: ['2'], label: 'Act 2 · OLTP vs OLAP', scope: 'Anywhere' },
  { keys: ['3'], label: 'Act 3 · Cube', scope: 'Anywhere' },
  { keys: ['4'], label: 'Act 4 · Schemas', scope: 'Anywhere' },
  { keys: ['5'], label: 'Act 5 · Medallion', scope: 'Anywhere' },
  { keys: ['6'], label: 'Act 6 · Mining', scope: 'Anywhere' },
  { keys: ['7'], label: 'Act 7 · SQL Playground', scope: 'Anywhere' },
  { keys: ['8'], label: 'Act 8 · Take-home', scope: 'Anywhere' },
  { keys: ['9'], label: 'Act 9 · CFO Finance Lab', scope: 'Anywhere' },
  { keys: ['?'], label: 'Toggle this help', scope: 'Anywhere' },
];

const ACT5: ShortcutRow[] = [
  { keys: ['D'], label: 'Inject schema drift' },
  { keys: ['U'], label: 'Inject dupe flood' },
  { keys: ['N'], label: 'Inject null flood' },
  { keys: ['Space'], label: 'Replay the pipeline' },
  { keys: ['R'], label: 'Reset to seeded state' },
  { keys: ['Q'], label: 'Jump to DQ event log' },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as any)?.isContentEditable) return;
      if (e.key === '?') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative panel w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-gold-300"><IconSparkle size={18} /></span>
                <h2 className="font-display text-lg">Keyboard shortcuts</h2>
              </div>
              <button onClick={() => setOpen(false)} className="btn btn-ghost p-2">
                <IconCross size={14} />
              </button>
            </header>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-auto scroll-thin">
              <Section title="Navigation" rows={GLOBAL} />
              <Section title="Act 5 — Medallion" rows={ACT5} />
              <p className="text-[11px] text-zinc-500 pt-2 border-t border-white/5">
                Shortcuts are ignored while an input / editor is focused. Press <span className="kbd">?</span> anywhere to toggle.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">{title}</div>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/3">
            <span className="text-sm text-zinc-200">{r.label}</span>
            <span className="flex gap-1">
              {r.keys.map((k) => <span key={k} className="kbd">{k}</span>)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
