export function CodeBlock({
  code,
  label,
  wrap = false,
}: {
  code: string;
  label?: string;
  wrap?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 overflow-hidden backdrop-blur-sm">
      {label && (
        <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <span>{label}</span>
          <span className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500/60" />
            <span className="w-2 h-2 rounded-full bg-amber-400/60" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
          </span>
        </div>
      )}
      <pre
        className={`text-xs leading-relaxed p-3 text-zinc-200 font-mono scroll-thin overflow-auto ${
          wrap ? 'whitespace-pre-wrap' : ''
        }`}
      >
        {code}
      </pre>
    </div>
  );
}
