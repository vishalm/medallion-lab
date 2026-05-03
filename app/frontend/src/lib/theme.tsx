/**
 * Theme system — light + dark, stored in localStorage, syncs to <html>.
 *
 * The CSS variables in styles.css read `html.dark` / `html.light` and swap
 * the entire token set. JS just toggles those classes.
 *
 * On first visit we follow `prefers-color-scheme`; after the user picks
 * we honour that pick across reloads.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'dataai.theme';

function readInitial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.remove(t === 'dark' ? 'light' : 'dark');
  html.classList.add(t);
  html.style.colorScheme = t;
}

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };
const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = readInitial();
    // apply synchronously on first render so there's no flash
    if (typeof document !== 'undefined') applyTheme(t);
    return t;
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const value = useMemo<Ctx>(() => ({
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
