import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Panel } from '../Panel';
import { Stat } from '../Stat';
import { DataTable } from '../DataTable';
import { Callout } from '../Callout';
import { api } from '../../lib/api';
import { fmtMoney, fmtNum } from '../../lib/format';
import { DecideExtra } from './DecideExtra';

const DEPT_COLOURS = ['#f1b02c', '#b07b3a', '#93a0ac', '#8b5cf6', '#10b981'];

export function DecideStage() {
  const [kpis, setKpis] = useState<any>(null);
  const [spend, setSpend] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [drill, setDrill] = useState<any | null>(null);
  const [drillTitle, setDrillTitle] = useState('');

  useEffect(() => {
    Promise.all([
      api.finKpis(),
      api.finSpendByDeptMonth(),
      api.finTopVendors(15),
    ]).then(([k, s, v]) => {
      setKpis(k);
      setSpend(s.rows);
      setVendors(v.rows);
    });
  }, []);

  // Pivot spend: months on x, depts as separate series.
  const { spendChartData, deptKeys } = useMemo(() => {
    if (!spend.length) return { spendChartData: [], deptKeys: [] };
    const byMonth = new Map<string, any>();
    const depts = new Set<string>();
    for (const r of spend) {
      depts.add(r.dept_name);
      const key = r.month_label;
      if (!byMonth.has(key)) byMonth.set(key, { month_label: key });
      byMonth.get(key)![r.dept_name] = r.total_aed;
      byMonth.get(key)![`__id_${r.dept_name}`] = `${r.dept_id}|${r.year}|${r.month}`;
    }
    const data = Array.from(byMonth.values()).sort((a, b) =>
      a.month_label.localeCompare(b.month_label)
    );
    return { spendChartData: data, deptKeys: Array.from(depts).sort() };
  }, [spend]);

  // Vendors: pareto cumulative pct as line over bars.
  const vendorChartData = useMemo(
    () => vendors.map((v) => ({
      name: v.canonical_name,
      total: v.total_aed,
      cum_pct: v.cumulative_pct,
      vendor_id: v.vendor_id,
    })),
    [vendors],
  );

  const drillBar = async (entry: any, deptName: string) => {
    const idStr = entry?.payload?.[`__id_${deptName}`];
    if (!idStr) return;
    const [dept_id, year, month] = idStr.split('|');
    const data = await api.finDrillDept(dept_id, Number(year), Number(month), 25);
    setDrill(data);
    setDrillTitle(`${deptName} · ${entry.payload.month_label}`);
  };

  const drillVendor = async (entry: any) => {
    const vendor_id = entry?.payload?.vendor_id;
    if (!vendor_id) return;
    const data = await api.finDrillVendor(vendor_id, 25);
    setDrill({
      ...data,
      rows: data.rows,
    });
    setDrillTitle(`Vendor · ${data.canonical_name}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total spend" tone="gold"
          value={kpis ? `${fmtMoney(kpis.total_aed)} AED` : '-'}
          hint={kpis ? `${kpis.date_min} → ${kpis.date_max}` : undefined} />
        <Stat label="Transactions" value={kpis ? fmtNum(kpis.txn_count) : '-'} />
        <Stat label="Vendors" value={kpis ? fmtNum(kpis.vendor_count) : '-'} />
        <Stat label="Top-5 concentration" tone="violet"
          value={kpis ? `${kpis.top5_concentration_pct.toFixed(1)}%` : '-'}
          hint="Pareto: how much of total spend goes to the top 5 vendors" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel
          title="Spend by department × month"
          subtitle="Stacked bar - click any segment to drill into the rows behind it"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={spendChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--glass-border)" vertical={false} />
              <XAxis dataKey="month_label" stroke="var(--text-4)" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
              <YAxis stroke="var(--text-4)" tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                tickFormatter={(v) => fmtMoney(Number(v))} />
              <Tooltip
                formatter={(v: any) => `${fmtMoney(Number(v))} AED`}
                contentStyle={{
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border-strong)',
                  borderRadius: 8,
                  color: 'var(--text-1)',
                  backdropFilter: 'blur(12px)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-2)' }}
                itemStyle={{ color: 'var(--text-1)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {deptKeys.map((d, i) => (
                <Bar
                  key={d}
                  dataKey={d}
                  stackId="a"
                  fill={DEPT_COLOURS[i % DEPT_COLOURS.length]}
                  onClick={(entry: any) => drillBar(entry, d)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Top vendors · Pareto"
          subtitle="Bars = total AED. Line = cumulative %. Click a bar to drill."
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={vendorChartData} margin={{ top: 10, right: 8, left: 0, bottom: 18 }}>
              <CartesianGrid stroke="var(--glass-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-4)" tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis yAxisId="left" stroke="var(--text-4)" tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                tickFormatter={(v) => fmtMoney(Number(v))} />
              <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6"
                tick={{ fontSize: 10, fill: '#8b5cf6' }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border-strong)',
                  borderRadius: 8,
                  color: 'var(--text-1)',
                  backdropFilter: 'blur(12px)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-2)' }}
                itemStyle={{ color: 'var(--text-1)' }}
                formatter={(v: any, name: string) =>
                  name === 'cum_pct'
                    ? `${Number(v).toFixed(1)}%`
                    : `${fmtMoney(Number(v))} AED`}
              />
              <Bar yAxisId="left" dataKey="total" name="Spend (AED)"
                onClick={(entry: any) => drillVendor(entry)}
                style={{ cursor: 'pointer' }}>
                {vendorChartData.map((_, i) => (
                  <Cell key={i} fill="#f1b02c" />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="cum_pct" name="Cumulative %"
                stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {drill && (
        <Panel
          title={`Drill-down · ${drillTitle}`}
          subtitle={
            drill.total_aed !== undefined
              ? `${fmtMoney(drill.total_aed)} AED across ${drill.rows.length} rows shown`
              : undefined
          }
          right={
            <button onClick={() => setDrill(null)} className="text-xs text-zinc-400 hover:text-zinc-200">
              close
            </button>
          }
        >
          <DataTable rows={drill.rows ?? []} maxHeight={300} />
        </Panel>
      )}

      <Callout tone="violet" title="Teaching point - DECIDE">
        Click any segment of the bar chart or any vendor bar - the panel
        opens with the row-level transactions behind it, just like
        click-through in Power BI.{' '}
        <strong>Every CFO chart is a <code className="text-gold-300">SELECT … GROUP BY</code>{' '}
        over a Gold mart.</strong> The Gold marts make the dashboards
        fast; the Silver detail makes them trustworthy.
      </Callout>

      <div className="pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="text-[11px] uppercase tracking-[0.25em] mb-3"
             style={{ color: 'var(--text-3)' }}>
          More dashboards
        </div>
        <DecideExtra />
      </div>
    </div>
  );
}
