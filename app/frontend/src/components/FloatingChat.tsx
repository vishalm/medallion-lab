/**
 * Persistent ask-anywhere chat. Three states:
 *
 *   closed   -> small floating button (FAB), bottom-right
 *   mini     -> compact 360x460 popover
 *   expanded -> larger 520x680 panel
 *
 * Lives at z-40 - below ShortcutsModal (z-50) but above all act content.
 * Uses `top: max(...)` constraint so the panel never slips under the
 * mobile top nav. Hits the same /api/finance/ask backend the AskStage
 * uses, so the LLM provider config (Ollama / Azure / OpenRouter / NVIDIA)
 * comes from .env without a code change here.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../lib/api';
import {
  IconArrowRight, IconCross, IconPlay, IconSparkle,
} from '../icons';
import { RichResponse } from './finance/RichResponse';

type Size = 'closed' | 'mini' | 'expanded';

type Turn = {
  question: string;
  pending: boolean;
  result?: any;
  error?: string;
};

const PRESETS = [
  'Top 5 vendors by total spend.',
  'What did Marketing spend last month?',
  'Show me Amazon spend by month.',
];

export function FloatingChat() {
  const [size, setSize] = useState<Size>('closed');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [llmOk, setLlmOk] = useState<boolean | null>(null);
  const [warmedUp, setWarmedUp] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Health check once on mount so the FAB can show a status dot.
  useEffect(() => {
    api.finLlmHealth().then((h) => setLlmOk(!!h.ok)).catch(() => setLlmOk(false));
  }, []);

  // Warm-up the model the first time the panel actually opens.
  useEffect(() => {
    if (size !== 'closed' && !warmedUp) {
      setWarmedUp(true);
      api.finLlmWarmup().catch(() => { /* surfaced on first ask if it fails */ });
    }
  }, [size, warmedUp]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setTurns((prev) => [...prev, { question, pending: true }]);
    try {
      const result = await api.finAsk(question);
      setTurns((prev) => updateLast(prev, (t) => {
        t.pending = false;
        t.result = result;
        if (result?.error) t.error = result.error;
      }));
    } catch (e: any) {
      setTurns((prev) => updateLast(prev, (t) => {
        t.pending = false;
        t.error = e.message ?? String(e);
      }));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    ask(q);
  };

  const dims = size === 'expanded'
    ? { width: 'min(520px, calc(100vw - 24px))', height: 'min(680px, calc(100vh - 120px))' }
    : { width: 'min(380px, calc(100vw - 24px))', height: 'min(500px, calc(100vh - 120px))' };

  return (
    <>
      {/* The floating action button - always present, even when chat is open */}
      <button
        onClick={() => setSize(size === 'closed' ? 'mini' : 'closed')}
        aria-label={size === 'closed' ? 'Open ask chat' : 'Close ask chat'}
        className="fixed bottom-5 right-5 z-40 group"
        style={{
          // Don't slip under the mobile top nav (~52px tall) on tiny phones -
          // FAB has its own anchor at the bottom, so this is mostly cosmetic.
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <span
          className="relative flex items-center gap-2 rounded-full pl-3.5 pr-4 py-3 transition
                     border border-gold-400/55"
          style={{
            background: 'linear-gradient(180deg, rgba(241,176,44,0.42), rgba(241,176,44,0.18))',
            boxShadow: '0 18px 40px -16px rgba(241,176,44,0.55), 0 0 0 1px rgba(241,176,44,0.18) inset',
            backdropFilter: 'blur(14px)',
            color: 'var(--text-1)',
          }}
        >
          <span className="relative">
            <IconSparkle size={16} />
            {/* status dot */}
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full
                ${llmOk === null ? 'bg-zinc-500' : llmOk ? 'bg-emerald-400 animate-pulseDot' : 'bg-rose-400'}`}
              aria-hidden
            />
          </span>
          <span className="text-xs font-medium tracking-wide">
            {size === 'closed' ? 'Ask the data' : 'Close'}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {size !== 'closed' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            className="fixed bottom-20 right-5 z-40 panel overflow-hidden flex flex-col"
            style={{
              ...dims,
              // Hard cap so the panel can never overlap the mobile top nav.
              maxHeight: 'calc(100vh - max(72px, env(safe-area-inset-top, 0px) + 64px))',
            }}
          >
            <ChatHeader size={size} setSize={setSize} llmOk={llmOk} />

            <div className="flex-1 min-h-0 overflow-auto scroll-thin px-4 py-3 space-y-3">
              {turns.length === 0 ? (
                <EmptyState onPick={ask} disabled={busy} />
              ) : (
                turns.map((t, i) => <TurnRow key={i} turn={t} compact={size === 'mini'} />)
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={submit}
              className="border-t border-white/5 bg-black/30 backdrop-blur px-3 py-3 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about spend, vendors, departments…"
                className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm t-1
                           focus:outline-none focus:border-gold-300/60 placeholder:t-4"
                style={{
                  background: 'var(--glass-1)',
                  borderColor: 'var(--glass-border-strong)',
                }}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn-gold text-xs shrink-0"
                aria-label="Send"
              >
                <IconPlay size={12} /> Ask
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ----- helpers ------------------------------------------------------------

function updateLast(turns: Turn[], mutate: (t: Turn) => void): Turn[] {
  const copy = [...turns];
  mutate(copy[copy.length - 1]);
  return copy;
}

function ChatHeader({
  size, setSize, llmOk,
}: {
  size: Size;
  setSize: (s: Size) => void;
  llmOk: boolean | null;
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gold-300 shrink-0"><IconSparkle size={16} /></span>
        <div className="min-w-0">
          <div className="font-display text-sm text-zinc-50 leading-tight truncate">Ask the data</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 leading-tight flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                llmOk === null ? 'bg-zinc-500' : llmOk ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
              aria-hidden
            />
            {llmOk === null ? 'checking model' : llmOk ? 'local LLM ready' : 'LLM offline'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setSize(size === 'expanded' ? 'mini' : 'expanded')}
          className="btn btn-ghost p-1.5"
          aria-label={size === 'expanded' ? 'Shrink' : 'Expand'}
          title={size === 'expanded' ? 'Shrink' : 'Expand'}
        >
          <ResizeIcon shrunk={size === 'mini'} />
        </button>
        <button
          onClick={() => setSize('closed')}
          className="btn btn-ghost p-1.5"
          aria-label="Close"
          title="Close"
        >
          <IconCross size={12} />
        </button>
      </div>
    </header>
  );
}

function ResizeIcon({ shrunk }: { shrunk: boolean }) {
  // Two diagonal arrows; flip direction based on state.
  return shrunk ? (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h4v4" />
      <path d="M13 3l-5 5" />
      <path d="M7 13H3v-4" />
      <path d="M3 13l5-5" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V3h4" />
      <path d="M3 3l5 5" />
      <path d="M13 9v4h-4" />
      <path d="M13 13l-5-5" />
    </svg>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400 leading-relaxed">
        Ask anything about the CFO finance data - spend, vendors, departments,
        anomalies. The local model writes the SQL, we run it on SQLite, you get rows.
      </p>
      <div className="space-y-1.5">
        {PRESETS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            disabled={disabled}
            className="w-full text-left text-sm rounded-lg px-3 py-2 border border-white/5 bg-white/[0.025]
                       hover:bg-white/[0.06] hover:border-gold-300/30 transition disabled:opacity-50
                       flex items-center justify-between gap-2"
          >
            <span className="text-zinc-200 truncate">{q}</span>
            <span className="text-zinc-500 shrink-0"><IconArrowRight size={12} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnRow({ turn, compact }: { turn: Turn; compact: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-zinc-500 flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest">you</span>
      </div>
      <div className="text-sm text-zinc-100 leading-snug">{turn.question}</div>

      {turn.pending && (
        <div className="text-xs text-zinc-500 italic flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulseDot" />
          thinking…
        </div>
      )}

      {turn.error && (
        <div className="rounded-md border border-rose-700/40 bg-rose-900/20 px-2.5 py-2 text-xs text-rose-200 leading-relaxed">
          {turn.error}
        </div>
      )}

      {turn.result && !turn.error && (
        <div className="rounded-lg border p-2.5"
          style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-2)' }}>
          <RichResponse result={turn.result} dense={compact} />
        </div>
      )}
    </div>
  );
}
