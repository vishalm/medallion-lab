/**
 * Theme toggle. Two visual modes:
 *   - 'pill'   wide segmented switch (sun | moon) — for the desktop sidebar
 *   - 'icon'   single icon button — for compact contexts (mobile top nav, FAB row)
 *
 * Keyboard: Space / Enter toggles. Aria label flips with state.
 */
import { motion } from 'framer-motion';
import { useTheme } from '../lib/theme';
import { IconMoon, IconSun } from '../icons';

export function ThemeToggle({ variant = 'pill' }: { variant?: 'pill' | 'icon' }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'icon') {
    return (
      <button
        onClick={toggle}
        title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        className="rounded-full p-2 transition border t-1 hover:bg-white/5"
        style={{
          borderColor: 'var(--glass-border-strong)',
          background: 'var(--glass-1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {isDark ? <IconMoon size={14} /> : <IconSun size={14} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className="relative inline-flex items-center w-[60px] h-[28px] rounded-full p-0.5 transition border outline-none
                 focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[var(--accent)]"
      style={{
        borderColor: 'var(--glass-border-strong)',
        background: 'var(--glass-1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Track icons (always visible, dimmed) */}
      <span className="absolute inset-0 flex items-center justify-between px-[7px] pointer-events-none">
        <span className={`transition-opacity ${isDark ? 'opacity-30' : 'opacity-90'} text-[var(--accent)]`}>
          <IconSun size={12} />
        </span>
        <span className={`transition-opacity ${isDark ? 'opacity-90' : 'opacity-30'}`} style={{ color: 'var(--text-3)' }}>
          <IconMoon size={12} />
        </span>
      </span>

      {/* Sliding knob */}
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 32 }}
        className="relative w-[22px] h-[22px] rounded-full shadow-sm flex items-center justify-center"
        style={{
          marginLeft: isDark ? 30 : 0,
          background: isDark
            ? 'linear-gradient(180deg, rgba(60,60,80,0.95), rgba(20,20,30,0.95))'
            : 'linear-gradient(180deg, #ffffff, #f3e8b8)',
          boxShadow: isDark
            ? 'inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 4px rgba(0,0,0,0.6)'
            : 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 6px rgba(241,176,44,0.45)',
        }}
      >
        <span className={isDark ? 'text-zinc-200' : 'text-amber-700'}>
          {isDark ? <IconMoon size={11} /> : <IconSun size={11} />}
        </span>
      </motion.span>
    </button>
  );
}
