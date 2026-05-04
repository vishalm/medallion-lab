import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { StudentNote } from '../components/Callout';
import { api } from '../lib/api';

type Shape = 'star' | 'snowflake' | 'galaxy';

export default function Act4Schemas() {
  const [shape, setShape] = useState<Shape>('star');
  const [data, setData] = useState<any>(null);
  const [storage, setStorage] = useState<any[]>([]);

  useEffect(() => {
    api.schema(shape).then(setData);
  }, [shape]);

  useEffect(() => {
    api.storageModels().then((r) => setStorage(r.models));
  }, []);

  const { nodes, edges } = useMemo(() => buildGraph(data), [data]);

  return (
    <div>
      <ActHeader
        actNumber="04"
        eyebrow="Dimensional modeling"
        slideRef="10–13"
        title="Star. Snowflake. Galaxy."
        subtitle="Three ways to arrange facts and dimensions. Start star. Snowflake if a dim is huge and rarely changes. Galaxy arrives on its own when the business grows. Watch the diagram morph."
      />

      <Panel
        title="Schema morph"
        subtitle={data?.note ?? ''}
        right={
          <div className="flex gap-1">
            {(['star', 'snowflake', 'galaxy'] as Shape[]).map((s) => (
              <button
                key={s}
                onClick={() => setShape(s)}
                className={`btn text-xs ${shape === s ? 'btn-gold' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        <div className="reactflow-wrapper rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            panOnDrag
            zoomOnScroll={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#27272a" gap={18} />
            <Controls
              showInteractive={false}
              className="!bg-zinc-900 !border !border-zinc-800 [&_button]:!bg-zinc-900 [&_button]:!border-zinc-800 [&_button]:!text-zinc-300"
            />
          </ReactFlow>
        </div>
      </Panel>

      <Panel className="mt-6" title="ROLAP · MOLAP · HOLAP" subtitle="Textbook treats them equal. Industry picked a winner.">
        <div className="grid md:grid-cols-3 gap-4">
          {storage.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-xl p-5 border ${
                m.winner
                  ? 'bg-gold-600/15 border-gold-500/40 shadow-glow'
                  : 'bg-zinc-900/60 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-2xl text-zinc-50">{m.name}</span>
                {m.winner && (
                  <span className="chip border-gold-500/60 text-gold-200">WON</span>
                )}
              </div>
              <div className="mt-4 text-xs uppercase tracking-widest text-zinc-500">Storage</div>
              <div className="text-sm text-zinc-200">{m.storage}</div>

              <div className="mt-3 text-xs uppercase tracking-widest text-zinc-500">Pro</div>
              <div className="text-sm text-emerald-300">{m.pro}</div>

              <div className="mt-3 text-xs uppercase tracking-widest text-zinc-500">Con</div>
              <div className="text-sm text-rose-300">{m.con}</div>

              <div className="mt-3 text-xs uppercase tracking-widest text-zinc-500">Today</div>
              <div className="text-sm text-zinc-300">{m.today}</div>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 text-sm text-zinc-400 leading-relaxed">
          Cloud warehouses use ROLAP storage + columnar and in-memory tricks to feel like MOLAP.
          You get both. You pay per query. You go home.
        </p>
      </Panel>

      <StudentNote title="Industry rule of thumb">
        <span className="mt-1 block">
          <strong className="text-violet-200">Start STAR.</strong> Snowflake only if a dim is huge and
          rarely changes (e.g. a product catalog with 5M SKUs). Galaxy arrives on its own when the
          business adds a second fact table - returns, inventory, clicks. Don't pre-engineer it.
        </span>
      </StudentNote>
    </div>
  );
}

function buildGraph(data: any): { nodes: Node[]; edges: Edge[] } {
  if (!data) return { nodes: [], edges: [] };

  const factsN = data.facts.length;
  const dimsN = data.dims.length;
  const nodes: Node[] = [];

  // Place facts on a horizontal line at top-center.
  data.facts.forEach((f: any, i: number) => {
    const xSpread = 240;
    const x = (i - (factsN - 1) / 2) * xSpread;
    nodes.push({
      id: f.id,
      position: { x: 400 + x, y: 60 },
      data: { label: factLabel(f) },
      type: 'default',
      style: factStyle(),
      sourcePosition: 'bottom' as any,
      targetPosition: 'top' as any,
    });
  });

  // Place dims around in a ring
  const R = 280;
  data.dims.forEach((d: any, i: number) => {
    const angle = (i / dimsN) * 2 * Math.PI;
    const x = 400 + Math.cos(angle) * R;
    const y = 360 + Math.sin(angle) * R * 0.55;
    nodes.push({
      id: d.id,
      position: { x: x - 90, y },
      data: { label: dimLabel(d) },
      type: 'default',
      style: dimStyle(),
    });
  });

  const edges: Edge[] = data.edges.map((e: any, i: number) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    animated: true,
    style: { stroke: 'rgba(241,176,44,0.55)', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(241,176,44,0.75)' },
  }));

  return { nodes, edges };
}

function factLabel(f: any): any {
  const attrs = (f.keys ?? []).concat(f.measures.map((m: string) => `${m} (measure)`));
  return (
    <div className="text-left">
      <div className="font-mono text-xs font-semibold text-gold-200">{f.name}</div>
      <div className="mt-1 text-[10px] text-zinc-400 leading-tight">{attrs.join(', ')}</div>
    </div>
  );
}

function dimLabel(d: any): any {
  return (
    <div className="text-left">
      <div className="font-mono text-xs font-semibold text-zinc-100">{d.name}</div>
      <div className="mt-1 text-[10px] text-zinc-400 leading-tight">{(d.attrs ?? []).join(', ')}</div>
    </div>
  );
}

function factStyle(): React.CSSProperties {
  return {
    border: '1px solid rgba(241,176,44,0.6)',
    background: 'rgba(241,176,44,0.12)',
    color: '#fff4c8',
    padding: '10px 12px',
    borderRadius: 12,
    width: 220,
  };
}

function dimStyle(): React.CSSProperties {
  return {
    border: '1px solid rgba(82,82,91,0.9)',
    background: 'rgba(24,24,27,0.95)',
    color: '#e4e4e7',
    padding: '10px 12px',
    borderRadius: 12,
    width: 180,
  };
}
