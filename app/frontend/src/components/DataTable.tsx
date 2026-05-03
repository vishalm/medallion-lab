export function DataTable({
  rows,
  columns,
  maxHeight = 340,
  empty = 'No rows.',
}: {
  rows: Record<string, any>[];
  columns?: string[];
  maxHeight?: number;
  empty?: string;
}) {
  if (!rows || rows.length === 0) {
    return <div className="text-xs text-zinc-500 py-6 text-center">{empty}</div>;
  }
  const cols = columns ?? Object.keys(rows[0]);
  return (
    <div
      className="overflow-auto scroll-thin rounded-md border border-zinc-800/80"
      style={{ maxHeight }}
    >
      <table className="data-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => {
                const v = row[c];
                return <td key={c}>{formatCell(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(3);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
