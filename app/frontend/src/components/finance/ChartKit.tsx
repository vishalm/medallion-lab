/**
 * ChartKit - fancy, theme-aware chart variants used by RichResponse and
 * the DECIDE / PREDICT extra dashboards.
 *
 * Every chart reads colours via CSS vars (--text-*, --glass-*) so it
 * adapts to light + dark theme automatically.
 *
 * Variants:
 *   <BigStat>       single-number hero with a glow ring + caption
 *   <FancyBar>      gradient-filled vertical bars with depth shadow
 *   <Donut>         pie with a glassmorphic ring + centre label
 *   <AreaTrend>     smooth area chart with a vertical gradient
 *   <ComposedDual>  bars + secondary line on dual axis
 *   <RadialBars>    circular bar gauge (looks like a sunburst dial)
 *   <RadarChart>    multi-dimension shape comparison
 */
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend,
  Line, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar,
  RadarChart as RechartsRadar, RadialBar, RadialBarChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { fmtMoney, fmtNum } from '../../lib/format';

// ----- shared theme-aware bits -------------------------------------------

const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-strong)',
  borderRadius: 8,
  color: 'var(--text-1)',
  backdropFilter: 'blur(12px)',
  fontSize: 12,
};
const LABEL_STYLE: React.CSSProperties = { color: 'var(--text-2)' };
const ITEM_STYLE: React.CSSProperties = { color: 'var(--text-1)' };

export const PALETTE = [
  '#f1b02c', '#8b5cf6', '#10b981', '#f43f5e', '#06b6d4',
  '#b07b3a', '#93a0ac', '#ec4899', '#84cc16', '#f59e0b',
];

const isAmountLike = (col?: string) =>
  !!col && /aed|amount|spend|total|sum/i.test(col);

const fmtVal = (v: any, col?: string) => {
  if (v == null) return '-';
  if (typeof v === 'number') {
    if (isAmountLike(col)) return `${fmtMoney(v)} AED`;
    return fmtNum(v, Number.isInteger(v) ? 0 : 2);
  }
  return String(v);
};

// ----- BigStat -----------------------------------------------------------

export function BigStat({
  label, value, valueCol, sub,
}: {
  label?: string;
  value: number | string;
  valueCol?: string;
  sub?: string;
}) {
  const display = typeof value === 'number' ? fmtVal(value, valueCol) : String(value);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="relative rounded-2xl px-6 py-8 overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 30% 20%, var(--accent-soft), transparent 60%)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div
        className="absolute -right-10 -top-10 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(241,176,44,0.35), transparent 65%)' }}
      />
      {label && (
        <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--text-3)' }}>
          {label}
        </div>
      )}
      <div className="font-display text-5xl tabular-nums tracking-tight mt-2"
        style={{ color: 'var(--accent-strong)' }}>
        {display}
      </div>
      {sub && <div className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </motion.div>
  );
}

// ----- FancyBar ----------------------------------------------------------

export function FancyBar({
  data, labelKey, valueKey, height = 260, gradient = 'gold',
}: {
  data: any[]; labelKey: string; valueKey: string; height?: number;
  gradient?: 'gold' | 'violet' | 'emerald';
}) {
  const grad = {
    gold:    { top: '#ffd977', mid: '#f1b02c', bot: '#8e6108' },
    violet:  { top: '#c4b5fd', mid: '#8b5cf6', bot: '#5b21b6' },
    emerald: { top: '#6ee7b7', mid: '#10b981', bot: '#065f46' },
  }[gradient];
  const id = `bar-${gradient}-${valueKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 6 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={grad.top} stopOpacity={1} />
            <stop offset="55%" stopColor={grad.mid} stopOpacity={0.95} />
            <stop offset="100%" stopColor={grad.bot} stopOpacity={0.85} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <CartesianGrid stroke="var(--glass-border)" vertical={false} />
        <XAxis
          dataKey={labelKey} stroke="var(--text-4)"
          tick={{ fontSize: 10, fill: 'var(--text-3)' }}
          interval={0} angle={-20} textAnchor="end" height={48}
        />
        <YAxis
          stroke="var(--text-4)"
          tick={{ fontSize: 10, fill: 'var(--text-3)' }}
          tickFormatter={(v) => isAmountLike(valueKey) ? fmtMoney(Number(v)) : fmtNum(Number(v))}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE}
          formatter={(v: any) => fmtVal(Number(v), valueKey)}
        />
        <Bar
          dataKey={valueKey}
          fill={`url(#${id})`}
          radius={[8, 8, 2, 2]}
          filter={`url(#${id}-glow)`}
          isAnimationActive
          animationDuration={650}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ----- Donut -------------------------------------------------------------

export function Donut({
  data, labelKey, valueKey, height = 240, palette = PALETTE,
}: {
  data: any[]; labelKey: string; valueKey: string; height?: number; palette?: string[];
}) {
  const total = data.reduce((acc, d) => acc + (Number(d[valueKey]) || 0), 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip
          contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE}
          formatter={(v: any, _n: string, p: any) => [fmtVal(Number(v), valueKey), p?.payload?.[labelKey]]}
        />
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={labelKey}
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={2}
          stroke="var(--glass-1)"
          strokeWidth={2}
          isAnimationActive animationDuration={700}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: 'var(--text-2)' }}
        />
        {/* centre label using foreignObject-ish via text in SVG */}
        <text
          x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: 'var(--text-1)', fontSize: 16, fontWeight: 600 }}
        >
          {isAmountLike(valueKey) ? fmtMoney(total) : fmtNum(total)}
        </text>
        <text
          x="50%" y="56%" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: 'var(--text-3)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}
        >
          total
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

// ----- AreaTrend ---------------------------------------------------------

export function AreaTrend({
  data, labelKey, valueKey, height = 240, gradient = 'gold',
}: {
  data: any[]; labelKey: string; valueKey: string; height?: number;
  gradient?: 'gold' | 'violet' | 'emerald';
}) {
  const grad = {
    gold:    { stroke: '#f1b02c', fill: 'rgba(241,176,44,0.45)' },
    violet:  { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.45)' },
    emerald: { stroke: '#10b981', fill: 'rgba(16,185,129,0.45)' },
  }[gradient];
  const id = `area-${gradient}-${valueKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={grad.fill} stopOpacity={0.9} />
            <stop offset="100%" stopColor={grad.fill} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--glass-border)" vertical={false} />
        <XAxis dataKey={labelKey} stroke="var(--text-4)"
          tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
        <YAxis stroke="var(--text-4)"
          tick={{ fontSize: 10, fill: 'var(--text-3)' }}
          tickFormatter={(v) => isAmountLike(valueKey) ? fmtMoney(Number(v)) : fmtNum(Number(v))} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE}
          formatter={(v: any) => fmtVal(Number(v), valueKey)}
        />
        <Area
          type="monotone"
          dataKey={valueKey}
          stroke={grad.stroke}
          strokeWidth={2}
          fill={`url(#${id})`}
          isAnimationActive animationDuration={700}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ----- ComposedDual ------------------------------------------------------

export function ComposedDual({
  data, labelKey, primaryKey, secondaryKey, secondaryUnit = '',
  height = 260,
}: {
  data: any[]; labelKey: string; primaryKey: string;
  secondaryKey: string; secondaryUnit?: string; height?: number;
}) {
  const id = `composed-${primaryKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 6 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#ffd977" />
            <stop offset="100%" stopColor="#8e6108" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--glass-border)" vertical={false} />
        <XAxis dataKey={labelKey} stroke="var(--text-4)"
          tick={{ fontSize: 10, fill: 'var(--text-3)' }}
          interval={0} angle={-20} textAnchor="end" height={48} />
        <YAxis yAxisId="left" stroke="var(--text-4)"
          tick={{ fontSize: 10, fill: 'var(--text-3)' }}
          tickFormatter={(v) => isAmountLike(primaryKey) ? fmtMoney(Number(v)) : fmtNum(Number(v))} />
        <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6"
          tick={{ fontSize: 10, fill: '#8b5cf6' }} unit={secondaryUnit} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE}
          formatter={(v: any, name: string) =>
            name === secondaryKey
              ? `${fmtNum(Number(v), 1)}${secondaryUnit}`
              : fmtVal(Number(v), primaryKey)}
        />
        <Bar yAxisId="left" dataKey={primaryKey} name={primaryKey}
          fill={`url(#${id})`} radius={[8, 8, 2, 2]}
          isAnimationActive animationDuration={650} />
        <Line yAxisId="right" type="monotone" dataKey={secondaryKey} name={secondaryKey}
          stroke="#8b5cf6" strokeWidth={2.4} dot={{ r: 2.4 }}
          isAnimationActive animationDuration={750} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ----- RadialBars (gauge-style) -----------------------------------------

export function RadialBars({
  data, labelKey, valueKey, height = 260, palette = PALETTE,
}: {
  data: any[]; labelKey: string; valueKey: string;
  height?: number; palette?: string[];
}) {
  const decorated = data.map((d, i) => ({
    ...d, fill: palette[i % palette.length],
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart
        innerRadius="22%" outerRadius="92%"
        data={decorated} startAngle={90} endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 'dataMax']} tick={false} />
        <RadialBar
          background={{ fill: 'var(--glass-2)' }}
          dataKey={valueKey}
          cornerRadius={8}
          isAnimationActive animationDuration={750}
        />
        <Legend
          iconSize={8} layout="vertical" verticalAlign="middle" align="right"
          wrapperStyle={{ fontSize: 11, color: 'var(--text-2)' }}
          formatter={(_v, _e, idx: any) => decorated[idx?.dataIndex]?.[labelKey] ?? ''}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE}
          formatter={(v: any) => fmtVal(Number(v), valueKey)}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

// ----- RadarMulti --------------------------------------------------------

export function RadarMulti({
  data, axisKey, seriesKeys, height = 320, palette = PALETTE,
}: {
  data: any[]; axisKey: string; seriesKeys: string[];
  height?: number; palette?: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} outerRadius="78%">
        <PolarGrid stroke="var(--glass-border)" />
        <PolarAngleAxis
          dataKey={axisKey}
          tick={{ fontSize: 10, fill: 'var(--text-2)' }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE}
          formatter={(v: any) => fmtMoney(Number(v)) + ' AED'}
        />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: 'var(--text-2)' }}
        />
        {seriesKeys.map((k, i) => (
          <Radar
            key={k}
            name={k}
            dataKey={k}
            stroke={palette[i % palette.length]}
            fill={palette[i % palette.length]}
            fillOpacity={0.18}
            isAnimationActive animationDuration={700}
          />
        ))}
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
