import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { CodeBlock } from '../components/CodeBlock';
import { DataTable } from '../components/DataTable';
import { api } from '../lib/api';
import { StudentNote, TryThis } from '../components/Callout';
import { IconCube } from '../icons';

type Move = 'slice' | 'dice' | 'drill' | 'rollup' | 'pivot';

interface MoveState {
  move: Move;
  label: string;
  group_by: string[];
  filters?: Record<string, string | null>;
  explain: string;
}

const MOVES: Record<Move, MoveState> = {
  slice: {
    move: 'slice',
    label: 'SLICE — one dim fixed',
    group_by: ['category', 'country'],
    filters: { quarter: '1' },
    explain: '"Sales in Q1" — cut one plane of the cube, keep the other dims free.',
  },
  dice: {
    move: 'dice',
    label: 'DICE — many dims fixed',
    group_by: ['category'],
    filters: { quarter: '1', country: 'India', channel: 'mobile' },
    explain: '"Q1, India, Mobile" — a small sub-cube.',
  },
  drill: {
    move: 'drill',
    label: 'DRILL-DOWN — go deeper',
    group_by: ['category', 'brand'],
    explain: 'Category → Brand. Same measure, finer grain.',
  },
  rollup: {
    move: 'rollup',
    label: 'ROLL-UP — go higher',
    group_by: ['category'],
    explain: 'Aggregate up. Same measure, coarser grain.',
  },
  pivot: {
    move: 'pivot',
    label: 'PIVOT — rotate axes',
    group_by: ['country', 'category'],
    explain: 'Swap the axes. Same data, different question.',
  },
};

export default function Act3Cube() {
  const [move, setMove] = useState<Move>('slice');
  const [rows, setRows] = useState<any[]>([]);
  const [sql, setSql] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = MOVES[move];
    setLoading(true);
    api.cubeQuery(s.group_by, 'amount', s.filters)
      .then((r) => { setRows(r.rows); setSql(r.sql); })
      .finally(() => setLoading(false));
  }, [move]);

  const maxVal = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.value ?? 0), 1),
    [rows],
  );

  return (
    <div>
      <ActHeader
        actNumber="03"
        eyebrow="Multidimensional thinking"
        slideRef="9"
        title="Reality is 3D+."
        subtitle="Rows and columns are 2D. Business questions aren't. Every PivotTable, every Looker 'Slice by region' button, is the data cube in disguise. Five moves let you answer almost any question against a star schema."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="The cube" subtitle="X = Product · Y = Geography · Z = Time · drag to rotate">
          <div className="h-[380px] rounded-xl border border-white/5 bg-black/30 overflow-hidden relative">
            <Canvas camera={{ position: [3.6, 2.8, 4.0], fov: 45 }}>
              <ambientLight intensity={0.55} />
              <directionalLight position={[3, 5, 4]} intensity={0.9} />
              <AnimatedCube move={move} />
              <AxisLabels />
              <OrbitControls enablePan={false} minDistance={3} maxDistance={9} />
            </Canvas>
            <div className="absolute left-3 top-3 text-[10px] uppercase tracking-widest text-zinc-500 pointer-events-none">
              drag · scroll to zoom
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {(Object.keys(MOVES) as Move[]).map((m) => (
              <button
                key={m}
                onClick={() => setMove(m)}
                className={`btn text-xs justify-center py-2.5 ${
                  move === m ? 'btn-gold' : ''
                }`}
              >
                {MOVES[m].label.split(' —')[0]}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={move}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300"
            >
              <span className="text-gold-300 font-medium">{MOVES[move].label}</span>
              <span className="ml-2 text-zinc-400">{MOVES[move].explain}</span>
            </motion.div>
          </AnimatePresence>
        </Panel>

        <Panel title="Equivalent SQL + result" subtitle={loading ? 'querying…' : 'on gold_fact_sales'}>
          <CodeBlock code={sql} label="Generated query" wrap />
          <div className="mt-4 space-y-2">
            {rows.slice(0, 8).map((r, i) => {
              const pct = Math.max(2, Math.min(100, (r.value / maxVal) * 100));
              const label = Object.entries(r)
                .filter(([k]) => k !== 'value')
                .map(([k, v]) => `${k}=${v}`)
                .join(' · ') || '—';
              return (
                <motion.div
                  key={label + i}
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="text-xs"
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-zinc-400 truncate pr-2">{label}</span>
                    <span className="text-zinc-300 font-mono">{Number(r.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-gold-600 to-gold-300"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-5">
            <DataTable rows={rows.slice(0, 25)} maxHeight={220} empty="No rows for this cube move." />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <TryThis>
          Press <strong>DRILL-DOWN</strong>, then <strong>PIVOT</strong>. The data underneath is
          identical — but the question you can answer with it changes completely. That is the
          whole point of dimensional modeling.
        </TryThis>
        <StudentNote title="Modern angle">
          You will not build a literal cube in 2026. You will build a star schema in Snowflake or
          BigQuery and query it with SQL — and every BI tool you touch will render the five moves
          above. <strong>Slice, dice, drill-down, roll-up, pivot.</strong> The shape stays.
        </StudentNote>
      </div>
    </div>
  );
}

function AxisLabels() {
  const labels = [
    { pos: [2.6, 0, 0] as [number, number, number], text: 'PRODUCT', color: '#f1b02c' },
    { pos: [0, 2.6, 0] as [number, number, number], text: 'GEOGRAPHY', color: '#a78bfa' },
    { pos: [0, 0, 2.6] as [number, number, number], text: 'TIME', color: '#34d399' },
  ];
  return (
    <group>
      {/* Axis lines */}
      <line>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-2.2, 0, 0, 2.2, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="#f1b02c" transparent opacity={0.4} />
      </line>
      <line>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, -2.2, 0, 0, 2.2, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="#a78bfa" transparent opacity={0.4} />
      </line>
      <line>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, -2.2, 0, 0, 2.2]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="#34d399" transparent opacity={0.4} />
      </line>
      {labels.map((l) => (
        <Html key={l.text} position={l.pos} center distanceFactor={8} zIndexRange={[0, 0]}>
          <div
            style={{
              color: l.color,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              letterSpacing: '0.2em',
              padding: '2px 6px',
              background: 'rgba(0,0,0,0.55)',
              border: `1px solid ${l.color}55`,
              borderRadius: 6,
              backdropFilter: 'blur(6px)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {l.text}
          </div>
        </Html>
      ))}
    </group>
  );
}

function AnimatedCube({ move }: { move: Move }) {
  const t = useMemo(() => {
    switch (move) {
      case 'slice': return { rotation: [0, 0.6, 0] as [number, number, number], scale: [1, 1, 0.25] as [number, number, number] };
      case 'dice': return { rotation: [0.2, 0.8, 0], scale: [0.45, 0.45, 0.45] };
      case 'drill': return { rotation: [0.1, 0.9, 0], scale: [1.2, 1.2, 1.2] };
      case 'rollup': return { rotation: [0.1, 1.2, 0], scale: [0.7, 0.7, 0.7] };
      case 'pivot': return { rotation: [0.3, 1.8, 0.4], scale: [1, 1, 1] };
    }
  }, [move]);

  return (
    <group rotation={t.rotation as any}>
      {Array.from({ length: 3 }).map((_, x) =>
        Array.from({ length: 3 }).map((_, y) =>
          Array.from({ length: 3 }).map((_, z) => {
            const isHighlight =
              (move === 'slice' && z === 2) ||
              (move === 'dice' && x === 1 && y === 1 && z === 2) ||
              (move === 'drill' && y === 0) ||
              (move === 'rollup' && y === 2) ||
              (move === 'pivot' && (x + y + z) % 2 === 0);
            const color = isHighlight ? '#f1b02c' : '#3f3f46';
            return (
              <mesh
                key={`${x}-${y}-${z}`}
                position={[
                  (x - 1) * 1.05 * t.scale[0],
                  (y - 1) * 1.05 * t.scale[1],
                  (z - 1) * 1.05 * t.scale[2],
                ]}
              >
                <boxGeometry args={[0.9, 0.9, 0.9]} />
                <meshStandardMaterial
                  color={color}
                  metalness={0.35}
                  roughness={0.45}
                  emissive={isHighlight ? '#f1b02c' : '#000'}
                  emissiveIntensity={isHighlight ? 0.25 : 0}
                />
              </mesh>
            );
          }),
        ),
      )}
    </group>
  );
}
