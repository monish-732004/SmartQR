import { buildHeatmapWeeks } from "@/lib/dashboardStats";
import { format } from "date-fns";

const LEVEL_COLORS = ["#e1e0d9", "#b7d3f6", "#6da7ec", "#2a78d6", "#184f95"];

function defaultLevelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function defaultTooltip(count: number): string {
  return `${count} session${count === 1 ? "" : "s"}`;
}

export default function Heatmap({
  dayCounts,
  levelFor = defaultLevelFor,
  tooltipFormatter = defaultTooltip,
}: {
  dayCounts: Map<string, number>;
  levelFor?: (value: number) => number;
  tooltipFormatter?: (value: number) => string;
}) {
  const columns = buildHeatmapWeeks(dayCounts, 26);

  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((cell, j) =>
              cell.date ? (
                <div
                  key={j}
                  title={`${format(cell.date, "MMM d, yyyy")}: ${tooltipFormatter(cell.count)}`}
                  className="h-[11px] w-[11px] rounded-[2px]"
                  style={{ backgroundColor: LEVEL_COLORS[levelFor(cell.count)] }}
                />
              ) : (
                <div key={j} className="h-[11px] w-[11px]" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
        <span>Less</span>
        {LEVEL_COLORS.map((c) => (
          <span
            key={c}
            className="h-[11px] w-[11px] rounded-[2px]"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
