const DEFAULT_ACCENT = "from-violet-500 to-sky-500";

export default function StatTile({
  label,
  value,
  sub,
  accent = DEFAULT_ACCENT,
  delayMs = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  delayMs?: number;
}) {
  return (
    <div
      className="animate-pop-in overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <div className="p-4">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p
          className={`mt-1 bg-gradient-to-r ${accent} bg-clip-text text-2xl font-bold tabular-nums text-transparent`}
        >
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
      </div>
    </div>
  );
}
