import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ActHeader } from '../components/ActHeader';
import { Panel } from '../components/Panel';
import { Stat } from '../components/Stat';
import { fmtNum } from '../lib/format';

// Approximate global-data-created estimates (IDC / Statista-style figures).
// Teaching aid — not a forecast.
const SERIES: { year: number; zb: number }[] = [
  { year: 2010, zb: 2 },   { year: 2012, zb: 6 },   { year: 2014, zb: 12 },
  { year: 2016, zb: 22 },  { year: 2018, zb: 33 },  { year: 2020, zb: 64 },
  { year: 2022, zb: 97 },  { year: 2023, zb: 120 }, { year: 2024, zb: 149 },
  { year: 2025, zb: 181 }, { year: 2026, zb: 221 }, { year: 2027, zb: 284 },
];

const MAX_ZB = SERIES[SERIES.length - 1].zb;

export default function Act1Landscape() {
  const [cursor, setCursor] = useState(0);
  const current = SERIES[cursor];

  useEffect(() => {
    if (cursor >= SERIES.length - 1) return;
    const t = setTimeout(() => setCursor(cursor + 1), 650);
    return () => clearTimeout(t);
  }, [cursor]);

  const postCovidPct = useMemo(() => {
    const total2026 = 221;
    const through2022 = 97;
    return Math.round(((total2026 - through2022) / total2026) * 100);
  }, []);

  return (
    <div>
      <ActHeader
        actNumber="01"
        eyebrow="The Landscape"
        slideRef="4–6"
        title="Every company is now a data company."
        subtitle="In 2026 there is no such thing as a 'non-tech' business. Airline, bank, retailer, hospital — all quietly running a data/AI org the size of a small country. The market is not short on demand; it is short on people who know what they are doing."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="2026 data created" value={`${fmtNum(current.zb)} ZB`} hint={`as of ${current.year}`} tone="gold" />
        <Stat label="Post-2022 share" value={`${postCovidPct}%`} hint="of all data ever, created since 2022" tone="bronze" />
        <Stat label="Global analytics spend" value="$1.8T" hint="by 2027" tone="silver" />
        <Stat label="Open data/AI roles" value="2.5M+" hint="worldwide" tone="default" />
      </div>

      <Panel
        title="Data volume, 2010 → 2027"
        subtitle="Each dot is a year. Watch the curve bend post-2020 — that's the jump you live in."
        right={
          <button
            onClick={() => setCursor(0)}
            className="btn text-xs"
          >
            Replay
          </button>
        }
      >
        <svg viewBox="0 0 800 320" className="w-full h-[340px]">
          {/* Y axis grid */}
          {[0, 50, 100, 150, 200, 250].map((y) => {
            const ypx = 300 - (y / 300) * 260;
            return (
              <g key={y}>
                <line x1={60} x2={780} y1={ypx} y2={ypx} stroke="rgb(39 39 42)" strokeDasharray="2 4" />
                <text x={10} y={ypx + 4} fill="rgb(113 113 122)" fontSize="11" fontFamily="monospace">{y}ZB</text>
              </g>
            );
          })}

          {/* Path */}
          <motion.path
            d={buildPath(SERIES, cursor)}
            fill="none"
            stroke="rgb(241 176 44)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6 }}
          />

          {/* Area under curve */}
          <motion.path
            d={buildAreaPath(SERIES, cursor)}
            fill="url(#goldGrad)"
            opacity={0.22}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.22 }}
          />
          <defs>
            <linearGradient id="goldGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(241 176 44)" />
              <stop offset="100%" stopColor="rgb(241 176 44)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Dots */}
          {SERIES.map((d, i) => {
            if (i > cursor) return null;
            const { x, y } = project(d);
            const r = i === cursor ? 8 : 4;
            const opacity = i === cursor ? 1 : 0.85;
            return (
              <g key={d.year} opacity={opacity}>
                <motion.circle
                  cx={x} cy={y} r={r}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r, opacity }}
                  transition={{ duration: 0.35 }}
                  fill={i === cursor ? 'rgb(255 217 119)' : 'rgb(241 176 44)'}
                  stroke={i === cursor ? 'rgba(255,217,119,0.4)' : 'none'}
                  strokeWidth={i === cursor ? 6 : 0}
                />
                {i === cursor && (
                  <text x={x + 12} y={y - 10} fill="rgb(255 235 170)" fontSize="13" fontFamily="Inter" fontWeight="600">
                    {d.year}: {d.zb} ZB
                  </text>
                )}
              </g>
            );
          })}

          {/* X axis labels (every other) */}
          {SERIES.filter((_, i) => i % 2 === 0).map((d) => {
            const { x } = project(d);
            return (
              <text key={d.year} x={x} y={316} fill="rgb(113 113 122)" fontSize="11" fontFamily="monospace" textAnchor="middle">{d.year}</text>
            );
          })}
        </svg>

        <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-3xl">
          Over <strong className="text-zinc-200">90%</strong> of the world's data was created after 2022. The curve
          bends because compute got cheap, storage got cheaper, and every interaction — tap, swipe, sensor read —
          now leaves a row somewhere. That is the economy you are about to walk into.
        </p>
      </Panel>
    </div>
  );
}

function project(d: { year: number; zb: number }): { x: number; y: number } {
  const minY = SERIES[0].year, maxY = SERIES[SERIES.length - 1].year;
  const x = 60 + ((d.year - minY) / (maxY - minY)) * 720;
  const y = 300 - (d.zb / Math.max(300, MAX_ZB)) * 260;
  return { x, y };
}

function buildPath(series: typeof SERIES, upTo: number): string {
  const pts = series.slice(0, upTo + 1).map(project);
  if (pts.length === 0) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function buildAreaPath(series: typeof SERIES, upTo: number): string {
  const pts = series.slice(0, upTo + 1).map(project);
  if (pts.length === 0) return '';
  const first = pts[0];
  const last = pts[pts.length - 1];
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return `${line} L ${last.x} 300 L ${first.x} 300 Z`;
}
