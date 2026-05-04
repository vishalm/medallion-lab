/**
 * Extra PREDICT panels beyond anomaly detection.
 *
 *   - Day-of-week pattern        FancyBar over avg spend per weekday
 *   - Next-month forecast        Per-dept linear projection with delta %
 *   - Vendor concentration risk  RadialBars + Gini coefficient gauge
 */
import { useEffect, useState } from 'react';
import { Panel } from '../Panel';
import { Stat } from '../Stat';
import { Callout } from '../Callout';
import { api } from '../../lib/api';
import { fmtMoney, fmtNum } from '../../lib/format';
import { FancyBar, RadialBars } from './ChartKit';

export function PredictExtra() {
  const [dow, setDow] = useState<any | null>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  const [conc, setConc] = useState<any | null>(null);

  useEffect(() => {
    Promise.all([
      api.finDowPattern(),
      api.finForecast(),
      api.finConcentration(),
    ]).then(([d, f, c]) => {
      setDow(d);
      setForecast(f.rows);
      setConc(c);
    });
  }, []);

  return (
    <div className="space-y-6">
      <Panel
        title="Day-of-week pattern"
        subtitle="When does your money actually move? Weekend bars are usually the surprise."
      >
        <div className="grid lg:grid-cols-[1fr,260px] gap-4 items-center">
          <div>
            {dow?.rows
              ? <FancyBar data={dow.rows} labelKey="day" valueKey="avg_aed" gradient="violet" />
              : <div className="text-xs t-4 py-6 text-center">loading…</div>}
          </div>
          <div className="space-y-2">
            <Stat
              label="Weekend share"
              tone="violet"
              value={dow ? `${dow.weekend_share_pct.toFixed(1)}%` : '-'}
              hint="of total spend posted on Sat/Sun"
            />
            <p className="text-xs t-3 leading-relaxed">
              Ask the obvious follow-up: <em>are weekends business spend, employee leakage,
              or vendor batch jobs?</em> The answer changes whether you optimise the policy
              or the system.
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        title="Next-month forecast · per department"
        subtitle="Simple linear regression on the last 6 months. Pedagogical, not production-grade."
      >
        {forecast.length > 0 ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forecast.map((row) => (
              <ForecastCard key={row.dept_name} row={row} />
            ))}
          </ul>
        ) : (
          <div className="text-xs t-4 py-6 text-center">loading…</div>
        )}
      </Panel>

      <Panel
        title="Vendor concentration risk"
        subtitle="How many vendors actually carry your spend? The Gini coefficient is one number that captures it."
      >
        <div className="grid lg:grid-cols-[1.4fr,1fr] gap-4 items-center">
          <div>
            {conc
              ? <RadialBars
                  data={conc.leaders}
                  labelKey="name"
                  valueKey="share_pct"
                  height={300}
                />
              : <div className="text-xs t-4 py-6 text-center">loading…</div>}
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Top 3"  value={conc ? `${conc.top_3_pct.toFixed(0)}%` : '-'} tone="gold" />
              <Stat label="Top 5"  value={conc ? `${conc.top_5_pct.toFixed(0)}%` : '-'} tone="gold" />
              <Stat label="Top 10" value={conc ? `${conc.top_10_pct.toFixed(0)}%` : '-'} tone="gold" />
            </div>
            <Stat
              label="Gini coefficient"
              tone="rose"
              value={conc ? conc.gini.toFixed(2) : '-'}
              hint="0 = perfectly even, 1 = one vendor takes everything"
            />
            <p className="text-xs t-3 leading-relaxed">
              When concentration creeps up, your negotiation leverage goes down and
              outage risk goes up. CFOs care about this number more than the average dashboard suggests.
            </p>
          </div>
        </div>
      </Panel>

      <Callout tone="violet" title="Teaching point - extra PREDICT panels">
        Anomalies catch yesterday. Forecasts and concentration scores manage tomorrow.{' '}
        <strong>The Silver layer feeds both.</strong> If your Silver is wrong, every model
        on top of it inherits the same wrongness - which is why we put it first in the lecture.
      </Callout>
    </div>
  );
}

function ForecastCard({ row }: { row: any }) {
  const isUp = row.delta_pct > 5;
  const isDown = row.delta_pct < -5;
  const tone = isUp ? 'rose' : isDown ? 'emerald' : 'gold';
  const arrow = isUp ? '▲' : isDown ? '▼' : '◆';
  return (
    <li
      className="rounded-xl p-4 relative overflow-hidden"
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-3)' }}>
        {row.dept_name}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl tabular-nums" style={{ color: 'var(--text-1)' }}>
          {fmtMoney(row.forecast_next_aed)}
        </span>
        <span className="text-xs t-3">AED</span>
      </div>
      <div className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
        last actual: <span className="font-mono" style={{ color: 'var(--text-2)' }}>
          {fmtMoney(row.last_actual_aed)} AED
        </span>
      </div>
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]"
        style={{
          background: tone === 'rose' ? 'rgba(244,63,94,0.15)' : tone === 'emerald' ? 'rgba(16,185,129,0.15)' : 'rgba(241,176,44,0.15)',
          color: tone === 'rose' ? 'rgb(159 18 57)' : tone === 'emerald' ? 'rgb(2 56 40)' : 'var(--accent-strong)',
          border: `1px solid ${tone === 'rose' ? 'rgba(244,63,94,0.4)' : tone === 'emerald' ? 'rgba(16,185,129,0.4)' : 'rgba(241,176,44,0.4)'}`,
        }}>
        <span>{arrow}</span>
        <span>{row.delta_pct > 0 ? '+' : ''}{fmtNum(row.delta_pct, 1)}% vs last month</span>
      </div>
    </li>
  );
}
