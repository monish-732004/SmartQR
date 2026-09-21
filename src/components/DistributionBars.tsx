export default function DistributionBars({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 text-neutral-600">{item.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: "#2a78d6",
              }}
            />
          </div>
          <span className="w-10 text-right tabular-nums text-neutral-500">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
