// `VITE_API_BASE` lets a static Pages build point at a real backend
// (e.g. a Railway URL) without code changes. Defaults to '/api' so
// local dev + Docker compose deploys keep working unchanged.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string; seeded: boolean }>(`/health`),
  reset: () => request<{ reset: boolean; counts: Record<string, number> }>(`/reset`, { method: 'POST' }),

  // Act 2
  oltpRead: () => request<any>(`/act2/oltp/read`),
  oltpInsert: () => request<any>(`/act2/oltp/insert`, { method: 'POST' }),
  olapOnOltp: () => request<any>(`/act2/olap/on-oltp`),
  olapOnGold: () => request<any>(`/act2/olap/on-gold`),

  // Act 3
  cubeMeta: () => request<{ dimensions: string[]; measures: string[] }>(`/act3/meta`),
  cubeQuery: (group_by: string[], measure: string, filters?: Record<string, string | null>) =>
    request<any>(`/act3/query`, {
      method: 'POST',
      body: JSON.stringify({ group_by, measure, filters }),
    }),

  // Act 4
  schema: (shape: 'star' | 'snowflake' | 'galaxy') => request<any>(`/act4/${shape}`),
  storageModels: () => request<{ models: any[] }>(`/act4/storage/models`),

  // Act 5
  layerCounts: () => request<Record<string, number>>(`/act5/counts`),
  dqEvents: () => request<{ events: any[] }>(`/act5/dq`),
  sampleLayer: (layer: string, limit = 20) =>
    request<{ layer: string; rows: any[] }>(`/act5/sample/${layer}?limit=${limit}`),
  inject: (kind: 'drift' | 'dupes' | 'nulls') =>
    request<any>(`/act5/inject/${kind}`, { method: 'POST' }),
  streamTick: (n = 1) =>
    request<any>(`/act5/stream/tick?n=${n}`, { method: 'POST' }),
  transformSilver: () => request<any>(`/act5/transform/silver`, { method: 'POST' }),
  transformGold: () => request<any>(`/act5/transform/gold`, { method: 'POST' }),
  replay: () => request<any>(`/act5/replay`, { method: 'POST' }),

  // Act 6
  clustering: (k: number) => request<any>(`/act6/clustering?k=${k}`),
  classification: (threshold: number) => request<any>(`/act6/classification?threshold=${threshold}`),
  regression: (horizon: number) => request<any>(`/act6/regression?horizon=${horizon}`),
  association: (min_support: number, min_confidence: number) =>
    request<any>(`/act6/association?min_support=${min_support}&min_confidence=${min_confidence}`),
  anomaly: (contamination: number) => request<any>(`/act6/anomaly?contamination=${contamination}`),

  // Act 7
  sqlExamples: () => request<{ examples: { label: string; sql: string }[] }>(`/act7/examples`),
  sqlRun: (sql: string) => request<any>(`/act7/run`, { method: 'POST', body: JSON.stringify({ sql }) }),
  sqlExplain: (sql: string) => request<any>(`/act7/explain`, { method: 'POST', body: JSON.stringify({ sql }) }),

  // Act 9 — CFO Finance Lab
  finRaw: (source: 'concur' | 'card', limit = 25) =>
    request<{ source: string; rows: any[] }>(`/finance/raw/${source}?limit=${limit}`),
  finCounts: () => request<Record<string, number>>(`/finance/counts`),
  finReseed: () => request<any>(`/finance/reseed`, { method: 'POST' }),
  finRunPipeline: () => request<any>(`/finance/run`, { method: 'POST' }),
  finSample: (layer: string, limit = 25) =>
    request<{ layer: string; rows: any[] }>(`/finance/sample/${layer}?limit=${limit}`),
  finKpis: () => request<any>(`/finance/marts/kpis`),
  finSpendByDeptMonth: () => request<{ rows: any[] }>(`/finance/marts/spend-by-dept-month`),
  finTopVendors: (limit = 20) =>
    request<{ rows: any[] }>(`/finance/marts/top-vendors?limit=${limit}`),
  finDrillDept: (dept_id: string, year: number, month: number, limit = 50) =>
    request<any>(`/finance/marts/drill/dept?dept_id=${encodeURIComponent(dept_id)}&year=${year}&month=${month}&limit=${limit}`),
  finDrillVendor: (vendor_id: string, limit = 50) =>
    request<any>(`/finance/marts/drill/vendor?vendor_id=${encodeURIComponent(vendor_id)}&limit=${limit}`),
  finAnomalies: (sensitivity: number, top_k = 25) =>
    request<any>(`/finance/anomalies?sensitivity=${sensitivity}&top_k=${top_k}`),
  finDailyTrend: (window_days = 90) =>
    request<{ rows: any[] }>(`/finance/marts/daily-trend?window_days=${window_days}`),
  finCurrencySplit: () => request<{ rows: any[] }>(`/finance/marts/currency-split`),
  finSourceSplit: () => request<{ rows: any[] }>(`/finance/marts/source-split`),
  finCategoryByDept: () => request<any>(`/finance/marts/category-by-dept`),
  finDowPattern: () => request<any>(`/finance/predict/dow-pattern`),
  finForecast: () => request<{ rows: any[] }>(`/finance/predict/forecast`),
  finConcentration: () => request<any>(`/finance/predict/concentration`),
  finPresets: () => request<{ presets: string[] }>(`/finance/ask/presets`),
  finAsk: (question: string) =>
    request<any>(`/finance/ask`, { method: 'POST', body: JSON.stringify({ question }) }),
  finLlmHealth: () => request<any>(`/finance/llm/health`),
  finLlmWarmup: () => request<any>(`/finance/llm/warmup`, { method: 'POST' }),
};
