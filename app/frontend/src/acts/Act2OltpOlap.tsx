import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { CodeBlock } from '../components/CodeBlock';
import { DataTable } from '../components/DataTable';
import { StudentNote, WarStory } from '../components/Callout';
import { api } from '../lib/api';
import { fmtMs, fmtNum } from '../lib/format';
import { IconAlert, IconBolt, IconDatabase, IconPlay, IconRefresh } from '../icons';

type TxnEvent = { id: number; kind: 'read' | 'insert'; row: any; latency: number };

export default function Act2OltpOlap() {
  const [events, setEvents] = useState<TxnEvent[]>([]);
  const [running, setRunning] = useState(true);
  const [overloaded, setOverloaded] = useState(false);
  const [olapOnOltp, setOlapOnOltp] = useState<any>(null);
  const [olapOnGold, setOlapOnGold] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);

  // Live OLTP ticker: one action per ~600ms. This is the "run the business" side.
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const r = Math.random() < 0.3 ? await api.oltpInsert() : await api.oltpRead();
        counter.current += 1;
        const delay = overloaded ? 60 : 5 + Math.random() * 20;
        // Simulate observed latency spiking during the OLAP-on-OLTP query.
        const latency = r.latency_ms ?? delay;
        setEvents((prev) => [
          { id: counter.current, kind: r.mode === 'oltp_insert' ? 'insert' : 'read',
            row: r.row, latency: overloaded ? latency + 40 + Math.random() * 60 : latency },
          ...prev.slice(0, 14),
        ]);
      } catch {
        // ignore transient errors
      }
      setTimeout(tick, 600 + Math.random() * 300);
    };
    const id = setTimeout(tick, 400);
    return () => { alive = false; clearTimeout(id); };
  }, [running, overloaded]);

  const runOlapOnOltp = async () => {
    setBusy(true);
    setOverloaded(true);
    try {
      const res = await api.olapOnOltp();
      setOlapOnOltp(res);
    } finally {
      setBusy(false);
      setTimeout(() => setOverloaded(false), 2500);
    }
  };

  const runOlapOnGold = async () => {
    setBusy(true);
    try {
      const res = await api.olapOnGold();
      setOlapOnGold(res);
    } finally {
      setBusy(false);
    }
  };

  const avgLat = events.length ? events.reduce((a, b) => a + b.latency, 0) / events.length : 0;

  return (
    <div>
      <ActHeader
        actNumber="02"
        eyebrow="Warehouse 101"
        slideRef="7–9"
        title="Same SQL. Completely different brains."
        subtitle="OLTP runs the business - tiny reads and writes, milliseconds. OLAP understands it - aggregates across millions of rows. Mix them up, and at 11 a.m. the intern's SUM() query crashes the bank. Watch it happen, safely."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* --- OLTP side --- */}
        <Panel
          title="OLTP · point reads + writes"
          subtitle="gold_fact-sized table, no indexes beyond PK - the 'bank' side"
          right={
            <button onClick={() => setRunning(!running)} className="btn text-xs">
              {running ? 'Pause' : 'Resume'}
            </button>
          }
        >
          <div className="flex gap-3 mb-4">
            <Stat label="Ops observed" value={fmtNum(counter.current)} icon={<IconDatabase size={14} />} />
            <Stat
              label="Avg latency"
              value={fmtMs(avgLat)}
              tone={overloaded ? 'rose' : 'emerald'}
              hint={overloaded ? 'OLAP running - degraded' : 'healthy'}
              icon={<IconBolt size={14} />}
            />
          </div>

          <div className="h-[280px] overflow-hidden relative rounded-md border border-zinc-800 bg-zinc-950/50">
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: -16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  layout
                  className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/80 font-mono text-xs"
                >
                  <span
                    className={`chip ${
                      e.kind === 'insert' ? 'border-emerald-700/60 text-emerald-300' : 'border-zinc-700 text-zinc-300'
                    }`}
                  >
                    {e.kind.toUpperCase()}
                  </span>
                  <span className="text-zinc-400 truncate">
                    {e.row?.txn_id ?? '(no row)'} · {e.row?.customer_id ?? '-'} · {e.row?.amount ?? '-'}
                  </span>
                  <span
                    className={`ml-auto tabular-nums ${
                      e.latency > 40 ? 'text-rose-300' : e.latency > 10 ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    {fmtMs(e.latency)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            {overloaded && (
              <div className="absolute inset-x-0 bottom-0 bg-rose-600/20 border-t border-rose-600/40 text-rose-200 text-xs px-3 py-2 flex items-center gap-2">
                <IconAlert size={14} />
                Query backlog detected - OLTP latency is spiking.
              </div>
            )}
          </div>
        </Panel>

        {/* --- OLAP side --- */}
        <Panel
          title="OLAP · aggregate queries"
          subtitle="Two choices: run on OLTP (wrong) or on Gold (right)"
        >
          <div className="space-y-3">
            <button
              onClick={runOlapOnOltp}
              disabled={busy}
              className="btn-danger w-full justify-center"
            >
              <IconPlay size={14} /> Run aggregate on OLTP &nbsp;
              <code className="font-mono text-xs opacity-80">
                SELECT SUM(amount) FROM oltp_transactions
              </code>
            </button>
            <button
              onClick={runOlapOnGold}
              disabled={busy}
              className="btn-gold w-full justify-center"
            >
              <IconPlay size={14} /> Same question, on the Gold fact table
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Stat
              label="OLTP query ms"
              value={fmtMs(olapOnOltp?.latency_ms ?? 0)}
              tone="rose"
              hint={`${fmtNum(olapOnOltp?.rows_scanned ?? 0)} rows scanned`}
            />
            <Stat
              label="Gold query ms"
              value={fmtMs(olapOnGold?.latency_ms ?? 0)}
              tone="gold"
              hint="indexed, pre-shaped"
            />
          </div>

          {olapOnOltp && (
            <div className="mt-4">
              <CodeBlock code={olapOnOltp.sql} label="OLTP query (blocks other traffic)" />
              <div className="mt-2"><DataTable rows={olapOnOltp.rows ?? []} maxHeight={140} /></div>
            </div>
          )}
          {olapOnGold && (
            <div className="mt-4">
              <CodeBlock code={olapOnGold.sql} label="Gold query (fast, isolated)" />
              <div className="mt-2"><DataTable rows={olapOnGold.rows ?? []} maxHeight={160} /></div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <WarStory title="The 11 a.m. intern query">
          A junior engineer runs <code>SELECT SUM(amount) FROM transactions</code> on the primary
          database during peak hour. Row-level locks pile up, customer transfers time out, the
          pager goes off. Every senior has lived this. The fix isn't "be careful" - it's "build a
          warehouse", which is Acts 4 and 5.
        </WarStory>
        <StudentNote title="What to take away">
          Same question, same SQL, two brains. <strong>OLTP</strong> is optimized for many small
          writes. <strong>OLAP</strong> is optimized for few huge reads. Mixing them means one
          workload always starves the other. The <em>entire modern stack</em> - ELT, lakehouses,
          Medallion - exists to keep them apart.
        </StudentNote>
      </div>
    </div>
  );
}
