import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  IconBookmark, IconBrain, IconChevronLeft, IconChevronRight, IconCoin, IconCube,
  IconDatabase, IconFlow, IconGlobe, IconLogo, IconStar, IconTerminal,
} from '../icons';
import { HealthPulse } from './HealthPulse';
import { ThemeToggle } from './ThemeToggle';

const ACTS = [
  { to: '/',      label: 'Overview',                 icon: IconLogo,     act: '',   key: '0' },
  { to: '/act/1', label: 'The Landscape',            icon: IconGlobe,    act: '01', key: '1' },
  { to: '/act/2', label: 'OLTP vs OLAP',             icon: IconDatabase, act: '02', key: '2' },
  { to: '/act/3', label: 'The Cube',                 icon: IconCube,     act: '03', key: '3' },
  { to: '/act/4', label: 'Star · Snowflake · Galaxy', icon: IconStar,    act: '04', key: '4' },
  { to: '/act/5', label: 'Medallion (Hero)',         icon: IconFlow,     act: '05', key: '5' },
  { to: '/act/6', label: 'Mining → AI',              icon: IconBrain,    act: '06', key: '6' },
  { to: '/act/7', label: 'SQL Playground',           icon: IconTerminal, act: '07', key: '7' },
  { to: '/act/8', label: 'Take-home',                icon: IconBookmark, act: '08', key: '8' },
  { to: '/act/9', label: 'CFO Finance Lab',          icon: IconCoin,     act: '09', key: '9' },
];

const STORAGE_KEY = 'dataai.nav.collapsed';

function readInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function useKeyboardNav() {
  const nav = useNavigate();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as any)?.isContentEditable) return;
      const act = ACTS.find((a) => a.key === e.key);
      if (act) nav(act.to);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nav]);
}

export function NavRail() {
  useKeyboardNav();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 h-screen sticky top-0 border-r z-20
                 transition-[width] duration-200 ease-out"
      style={{
        width: collapsed ? 68 : 224,
        background: 'linear-gradient(180deg, var(--glass-1), var(--glass-2))',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(28px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
      }}
    >
      <Header collapsed={collapsed} onToggle={toggle} />

      <nav className="flex-1 overflow-y-auto scroll-thin px-2 py-3 space-y-0.5">
        {ACTS.map(({ to, label, icon: Icon, act, key }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? `${label}  (${key})` : undefined}
              className={`group relative flex items-center rounded-lg transition outline-none
                          focus-visible:ring-1 focus-visible:ring-gold-300/60
                          ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-2.5 py-2'}
                          ${isActive ? 'text-zinc-50' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'}`}
            >
              {isActive && (
                <span
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(241,176,44,0.22), rgba(241,176,44,0.04))',
                    border: '1px solid rgba(241,176,44,0.42)',
                    boxShadow: '0 0 22px -8px rgba(241,176,44,0.55)',
                  }}
                />
              )}
              <span
                className={`relative shrink-0 transition-colors
                  ${isActive ? 'text-gold-200' : 'text-zinc-500 group-hover:text-gold-300'}`}
              >
                <Icon size={collapsed ? 19 : 17} />
              </span>
              {!collapsed && (
                <>
                  <span className="relative flex-1 truncate text-[13px]">{label}</span>
                  {act && (
                    <span className={`relative text-[10px] font-mono tracking-widest
                      ${isActive ? 'text-gold-300/80' : 'text-zinc-600'}`}>
                      {act}
                    </span>
                  )}
                  <span className="relative ml-1 kbd opacity-60 group-hover:opacity-100">{key}</span>
                </>
              )}
              {collapsed && (
                <span className="absolute -right-1 top-1 text-[9px] font-mono text-zinc-600 group-hover:text-gold-300">
                  {key}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <Footer collapsed={collapsed} />
    </aside>
  );
}

function Header({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="px-3 py-3.5 border-b border-white/5 flex items-center gap-2">
      {!collapsed ? (
        <>
          <span className="text-gold-300 shrink-0"><IconLogo size={20} /></span>
          <div className="leading-tight min-w-0 flex-1">
            <div className="font-display text-[15px] t-1 truncate">
              <span className="shimmer-text">Medallion</span> Lab
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] t-4 truncate">
              hands-on Data &amp; AI
            </div>
          </div>
        </>
      ) : (
        <span className="text-gold-300 mx-auto"><IconLogo size={20} /></span>
      )}
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition
                   focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold-300/60"
        style={collapsed ? { position: 'absolute', right: -10, top: 16, background: 'rgba(10,10,14,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999 } : undefined}
      >
        {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
      </button>
    </div>
  );
}

function Footer({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="px-2 py-3 border-t border-white/5 flex flex-col items-center gap-2.5">
        <HealthPulse />
        <ThemeToggle variant="icon" />
      </div>
    );
  }
  return (
    <div className="px-3 py-3 border-t border-white/5 text-[11px] t-4 leading-relaxed space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <HealthPulse />
        <ThemeToggle variant="pill" />
      </div>
      <div>
        Press <span className="kbd">0</span>–<span className="kbd">9</span>{' '}
        · <span className="kbd">?</span> shortcuts
      </div>
      <div className="text-[10px] t-5">SQLite ephemeral · synthetic data</div>
    </div>
  );
}

export function TopNav() {
  useKeyboardNav();
  return (
    <nav
      className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b sticky top-0 z-30"
      style={{
        background: 'var(--bg-overlay)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(16px) saturate(1.4)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-gold-300"><IconLogo size={18} /></span>
        <span className="font-display text-base t-1"><span className="shimmer-text">Medallion</span> Lab</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle variant="icon" />
        <select
          className="rounded-md px-2 py-1.5 text-sm border t-1"
          style={{
            background: 'var(--glass-1)',
            borderColor: 'var(--glass-border-strong)',
            backdropFilter: 'blur(8px)',
          }}
          onChange={(e) => { window.location.href = e.target.value; }}
          value={window.location.pathname}
        >
          {ACTS.map(({ to, label }) => (
            <option key={to} value={to}>{label}</option>
          ))}
        </select>
      </div>
    </nav>
  );
}
