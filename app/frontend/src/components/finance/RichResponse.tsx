/**
 * RichResponse - renders a text-to-SQL answer as Markdown narrative +
 * an auto-picked dynamic chart + the result table.
 *
 * Backend returns:
 *   { sql, rows, columns, narrative_md, chart_hint, latency_ms, model, ... }
 *
 * chart_hint.type drives which ChartKit variant we render. Falls back
 * gracefully to a clean DataTable when the shape doesn't fit a chart.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { DataTable } from '../DataTable';
import {
  AreaTrend, BigStat, ComposedDual, Donut, FancyBar,
} from './ChartKit';
import { fmtMs } from '../../lib/format';
import { IconSparkle } from '../../icons';

type ChartHint = {
  type: 'stat' | 'bar' | 'donut' | 'area' | 'composed' | 'table' | 'empty';
  label_col?: string | null;
  value_col?: string | null;
  secondary_col?: string | null;
};

export type RichAskResult = {
  question?: string;
  sql?: string;
  rows?: any[];
  columns?: string[];
  row_count?: number;
  truncated?: boolean;
  latency_ms?: number;
  model?: string;
  narrative_md?: string;
  chart_hint?: ChartHint;
  error?: string;
  raw_model_output?: string;
  stage?: string;
};

export function RichResponse({
  result, dense = false,
}: {
  result: RichAskResult;
  dense?: boolean;
}) {
  if (result.error) {
    return (
      <div className="rounded-md border px-3 py-2 text-sm"
        style={{
          borderColor: 'rgba(244,63,94,0.4)',
          background: 'rgba(244,63,94,0.10)',
          color: 'var(--text-1)',
        }}>
        {result.error}
        {result.sql && (
          <pre className="mt-2 text-[11px] whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
            {result.sql}
          </pre>
        )}
      </div>
    );
  }

  const rows = result.rows ?? [];
  const hint = result.chart_hint ?? { type: 'table' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Meta strip */}
      <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: 'var(--text-3)' }}>
        <span style={{ color: 'var(--accent)' }}><IconSparkle size={12} /></span>
        <span className="font-mono truncate">{result.model}</span>
        {result.latency_ms !== undefined && (
          <><span>·</span><span>{fmtMs(result.latency_ms)} on SQLite</span></>
        )}
        {result.row_count !== undefined && (
          <><span>·</span><span>{result.row_count} row{result.row_count === 1 ? '' : 's'}</span></>
        )}
      </div>

      {/* Markdown narrative */}
      {result.narrative_md && (
        <div className="prose-finance text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              strong: ({ children }) => (
                <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>{children}</strong>
              ),
              em: ({ children }) => (
                <em style={{ color: 'var(--text-3)' }}>{children}</em>
              ),
              ul: ({ children }) => (
                <ul className="my-2 space-y-1 list-none pl-0">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="flex gap-2 leading-snug">
                  <span style={{ color: 'var(--accent)' }}>›</span>
                  <span>{children}</span>
                </li>
              ),
              h2: ({ children }) => (
                <h2 className="text-[11px] uppercase tracking-[0.2em] mt-3 mb-1"
                    style={{ color: 'var(--text-3)' }}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xs font-semibold mt-2 mb-1"
                    style={{ color: 'var(--text-1)' }}>{children}</h3>
              ),
              p: ({ children }) => <p className="my-1.5">{children}</p>,
              code: ({ children }) => (
                <code className="px-1 rounded text-[11px] font-mono"
                  style={{ background: 'var(--glass-1)', color: 'var(--accent-strong)' }}>
                  {children}
                </code>
              ),
            }}
          >
            {result.narrative_md}
          </ReactMarkdown>
        </div>
      )}

      {/* Dynamic chart based on hint */}
      <ChartFromHint rows={rows} hint={hint} dense={dense} />

      {/* Optional SQL collapsible */}
      {result.sql && (
        <details className="text-xs">
          <summary className="cursor-pointer hover:opacity-100 select-none"
            style={{ color: 'var(--text-3)' }}>
            show SQL
          </summary>
          <pre className="mt-2 text-[11px] rounded-md p-2.5 overflow-auto whitespace-pre-wrap leading-relaxed"
            style={{
              background: 'var(--glass-2)',
              color: 'var(--text-1)',
              border: '1px solid var(--glass-border)',
            }}>
            {result.sql}
          </pre>
        </details>
      )}

      {/* Always offer the raw table - even when there's a chart, students
          want to see the underlying rows. */}
      {rows.length > 0 && hint.type !== 'stat' && (
        <details className="text-xs" open={false}>
          <summary className="cursor-pointer select-none" style={{ color: 'var(--text-3)' }}>
            show rows ({rows.length})
          </summary>
          <div className="mt-2">
            <DataTable rows={rows} maxHeight={dense ? 200 : 280} />
          </div>
        </details>
      )}
    </motion.div>
  );
}

function ChartFromHint({
  rows, hint, dense,
}: {
  rows: any[];
  hint: ChartHint;
  dense: boolean;
}) {
  if (rows.length === 0) return null;
  const h = dense ? 200 : 260;

  switch (hint.type) {
    case 'empty':
      return null;

    case 'stat': {
      const value = hint.value_col ? rows[0][hint.value_col] : Object.values(rows[0])[0];
      const label = hint.label_col ? String(rows[0][hint.label_col]) : undefined;
      return <BigStat label={label ?? hint.value_col ?? undefined} value={Number(value)}
        valueCol={hint.value_col ?? undefined} />;
    }

    case 'bar':
      return (
        <FancyBar
          data={rows}
          labelKey={hint.label_col!}
          valueKey={hint.value_col!}
          height={h}
        />
      );

    case 'donut':
      return (
        <Donut
          data={rows}
          labelKey={hint.label_col!}
          valueKey={hint.value_col!}
          height={h}
        />
      );

    case 'area':
      return (
        <AreaTrend
          data={rows}
          labelKey={hint.label_col!}
          valueKey={hint.value_col!}
          height={h}
        />
      );

    case 'composed':
      return (
        <ComposedDual
          data={rows}
          labelKey={hint.label_col!}
          primaryKey={hint.value_col!}
          secondaryKey={hint.secondary_col!}
          height={h}
        />
      );

    case 'table':
    default:
      // No chart fits; the rows section below covers it.
      return null;
  }
}
