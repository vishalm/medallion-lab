import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Panel } from '../Panel';
import { Callout } from '../Callout';
import { api } from '../../lib/api';
import { IconBolt, IconPlay, IconSparkle } from '../../icons';
import { RichResponse } from './RichResponse';

type Turn = {
  question: string;
  pending: boolean;
  result?: any;
  error?: string;
};

export function AskStage() {
  const [presets, setPresets] = useState<string[]>([]);
  const [llm, setLlm] = useState<any>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.finPresets().then((r) => setPresets(r.presets));
    api.finLlmHealth().then(setLlm);
    // Fire-and-forget warm-up so the first audience question doesn't pay the cold-start lag.
    api.finLlmWarmup().then(setLlm).catch(() => { /* surfaced via health */ });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setTurns((prev) => [...prev, { question, pending: true }]);
    try {
      const result = await api.finAsk(question);
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        last.pending = false;
        if (result.error) last.error = result.error;
        last.result = result;
        return copy;
      });
    } catch (e: any) {
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        last.pending = false;
        last.error = e.message ?? String(e);
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    await ask(q);
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Local LLM status"
        subtitle="Default: Ollama on localhost. Swap providers via .env (Azure / OpenRouter / NVIDIA / OpenAI)."
        tone={llm?.ok ? 'gold' : 'rose'}
        right={
          <button
            onClick={async () => {
              setLlm(await api.finLlmWarmup());
            }}
            className="btn text-xs"
            disabled={busy}
          >
            <IconBolt size={14} /> Warm up
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <Field label="Provider" value={llm?.provider ?? '…'} />
          <Field label="Model" value={llm?.model ?? '…'} />
          <Field label="Reachable" value={
            llm == null ? '…'
              : llm.ok ? 'yes' : 'no - is Ollama running?'
          } tone={llm?.ok ? 'ok' : 'warn'} />
        </div>
        {!llm?.ok && (
          <p className="mt-3 text-xs text-rose-200/90">
            Can't reach the LLM endpoint at <code className="text-rose-300">{llm?.base_url}</code>.
            Start Ollama with <code className="text-rose-300">ollama serve</code> and pull the model
            with <code className="text-rose-300">ollama pull {llm?.model}</code>, or change provider in <code>.env</code>.
          </p>
        )}
      </Panel>

      <Panel title="Ask a question" subtitle="Click a preset or type your own. The model writes the SQL; we run it.">
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {presets.map((q, i) => (
            <button
              key={i}
              onClick={() => ask(q)}
              disabled={busy}
              className="text-left text-sm rounded-lg px-3 py-2.5 border border-white/5 bg-white/[0.02]
                         hover:bg-white/[0.06] hover:border-gold-300/30 disabled:opacity-50 transition"
            >
              <span className="text-gold-300 mr-2"><IconSparkle size={12} /></span>
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. how much did Sales spend on travel in March?"
            className="flex-1 rounded-md border px-3 py-2 text-sm t-1
                       focus:outline-none focus:border-gold-300/60 placeholder:t-4"
            style={{
              background: 'var(--glass-1)',
              borderColor: 'var(--glass-border-strong)',
            }}
          />
          <button type="submit" disabled={busy || !input.trim()} className="btn-gold text-xs">
            <IconPlay size={14} /> Ask
          </button>
        </form>
      </Panel>

      {turns.length === 0 ? (
        <Callout tone="violet" title="Nothing asked yet">
          Click any preset above to see the model translate a finance question into SQL,
          run it against the Gold mart, and return rows - all in one round trip.
        </Callout>
      ) : (
        <div className="space-y-4">
          {turns.map((t, i) => (
            <TurnCard key={i} turn={t} />
          ))}
          <div ref={endRef} />
        </div>
      )}

      <Callout tone="violet" title="Teaching point - ASK">
        Text-to-SQL turns the warehouse into a conversation. Try a preset,
        then invite a student to type any finance question. When the model
        nails it, notice what made it possible: a tiny, opinionated schema
        (5 tables, clean names), few-shot examples, and a hard guard that
        rejects anything other than a SELECT.{' '}
        <strong>The LLM is the smallest part of the system.</strong>{' '}
        The platform around it is what makes it safe to put on a CFO's screen.
      </Callout>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  const colour = tone === 'ok' ? 'text-emerald-300' : tone === 'warn' ? 'text-rose-300' : 'text-zinc-100';
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-mono ${colour}`}>{value}</div>
    </div>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="text-sm">
        <span className="text-zinc-500 mr-2">You</span>
        <span className="text-zinc-100">{turn.question}</span>
      </div>

      {turn.pending && (
        <div className="text-xs text-zinc-500 italic flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold-300 animate-pulseDot" />
          model is thinking…
        </div>
      )}

      {turn.result && (
        <div className="rounded-lg border p-3"
          style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-2)' }}>
          <RichResponse result={turn.result} />
        </div>
      )}
    </motion.div>
  );
}
