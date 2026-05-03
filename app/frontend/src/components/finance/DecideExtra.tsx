/**
 * Extra DECIDE dashboards beyond the core dept-month bars + vendor Pareto.
 *
 * Three bite-size charts the CFO actually looks at:
 *   - Daily spend trend (last ~90 days, area chart)
 *   - Currency mix (donut)         — AED vs USD originals
 *   - Source mix   (donut)         — Concur vs Corporate Card
 *   - Category × Department radar  — multi-dimension dept profile
 */
import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../Panel';
import { Callout } from '../Callout';
import { api } from '../../lib/api';
import { AreaTrend, Donut, RadarMulti } from './ChartKit';

export function DecideExtra() {
  const [trend, setTrend] = useState<any[]>([]);
  const [currency, setCurrency] = useState<any[]>([]);
  const [source, setSource] = useState<any[]>([]);
  const [catByDept, setCatByDept] = useState<{
    rows: any[]; categories: string[]; departments: string[];
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api.finDailyTrend(90),
      api.finCurrencySplit(),
      api.finSourceSplit(),
      api.finCategoryByDept(),
    ]).then(([t, c, s, cd]) => {
      setTrend(t.rows);
      setCurrency(c.rows);
      setSource(s.rows);
      setCatByDept(cd);
    });
  }, []);

  // Pivot category-by-dept into radar shape: each category is an axis,
  // each department a data series.
  const radarData = useMemo(() => {
    if (!catByDept) return [];
    const out: any[] = [];
    for (const cat of catByDept.categories) {
      const row: any = { category: cat };
      for (const dept of catByDept.departments) {
        const found = catByDept.rows.find(
          (r) => r.category === cat && r.dept_name === dept
        );
        row[dept] = found ? found.total_aed : 0;
      }
      out.push(row);
    }
    return out;
  }, [catByDept]);

  return (
    <div className="space-y-6">
      <Panel
        title="Daily spend pulse"
        subtitle="Last 90 days · gradient area chart over the Silver layer"
      >
        {trend.length > 0
          ? <AreaTrend data={trend} labelKey="day" valueKey="total_aed" gradient="gold" />
          : <div className="text-xs t-4 py-6 text-center">loading…</div>}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel
          title="Currency mix"
          subtitle="Original-currency split (AED submitted vs USD card)"
        >
          {currency.length > 0
            ? <Donut data={currency} labelKey="currency" valueKey="total_aed" />
            : <div className="text-xs t-4 py-6 text-center">loading…</div>}
        </Panel>

        <Panel
          title="Source mix"
          subtitle="How much spend lands via Concur vs the corporate card"
        >
          {source.length > 0
            ? <Donut data={source} labelKey="source" valueKey="total_aed" />
            : <div className="text-xs t-4 py-6 text-center">loading…</div>}
        </Panel>
      </div>

      <Panel
        title="Department fingerprint · category radar"
        subtitle="Each axis is a spend category. Departments overlap to reveal where they're alike — and where they're not."
      >
        {radarData.length > 0 && catByDept
          ? <RadarMulti
              data={radarData}
              axisKey="category"
              seriesKeys={catByDept.departments}
              height={360}
            />
          : <div className="text-xs t-4 py-6 text-center">loading…</div>}
      </Panel>

      <Callout tone="violet" title="Teaching point — extra DECIDE charts">
        Same Silver layer, four different views. The radar in particular
        lets students <em>see</em> dept identity instantly: Marketing balloons
        on Marketing-category, Engineering on Software, Operations on
        Travel/Office. <strong>One trustworthy table → unlimited dashboards.</strong>
      </Callout>
    </div>
  );
}
