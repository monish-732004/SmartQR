"use client";

import { zonesFrom } from "@/lib/zones";
import type { ChargingPoint } from "@/lib/types";

const CUBE_SIZE = 48;
const HALF = CUBE_SIZE / 2;

type Status = "good" | "warn" | "full";

// [top, front, right] faces, lightest to darkest, per status.
const STATUS_COLORS: Record<Status, [string, string, string]> = {
  good: ["#d1fae5", "#6ee7b7", "#10b981"],
  warn: ["#fef3c7", "#fcd34d", "#f59e0b"],
  full: ["#f5f5f4", "#d6d3d1", "#a8a29e"],
};

function statusFor(ratio: number): Status {
  if (ratio >= 0.5) return "good";
  if (ratio > 0) return "warn";
  return "full";
}

function Cube({ status }: { status: Status }) {
  const [top, front, right] = STATUS_COLORS[status];
  return (
    <div className="h-16 w-16" style={{ perspective: 400 }}>
      <div
        className="relative h-full w-full transition-transform duration-200 group-hover:scale-110"
        style={{ transformStyle: "preserve-3d", transform: "rotateX(-28deg) rotateY(-35deg)" }}
      >
        <div
          className="absolute top-0 left-0 rounded-[3px] shadow-sm"
          style={{
            width: CUBE_SIZE,
            height: CUBE_SIZE,
            backgroundColor: top,
            transform: `rotateX(90deg) translateZ(${HALF}px)`,
          }}
        />
        <div
          className="absolute top-0 left-0 rounded-[3px]"
          style={{
            width: CUBE_SIZE,
            height: CUBE_SIZE,
            backgroundColor: front,
            transform: `translateZ(${HALF}px)`,
          }}
        />
        <div
          className="absolute top-0 left-0 rounded-[3px]"
          style={{
            width: CUBE_SIZE,
            height: CUBE_SIZE,
            backgroundColor: right,
            transform: `rotateY(90deg) translateZ(${HALF}px)`,
          }}
        />
      </div>
    </div>
  );
}

export default function FloorMap3D({
  points,
  selectedZone,
  onSelectZone,
}: {
  points: ChargingPoint[];
  selectedZone: string | null;
  onSelectZone: (label: string | null) => void;
}) {
  const zones = zonesFrom(points);

  return (
    <div className="mb-6 rounded-xl border border-neutral-300 bg-[#fafaf9] p-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {zones.map((zone) => {
          const ratio = zone.total === 0 ? 0 : zone.available / zone.total;
          const status = statusFor(ratio);
          const selected = selectedZone === zone.label;
          return (
            <button
              key={zone.label}
              onClick={() => onSelectZone(selected ? null : zone.label)}
              className={`group flex flex-col items-center gap-1 rounded-md p-2 transition-colors ${
                selected ? "bg-violet-100" : "hover:bg-neutral-100"
              }`}
            >
              <div className="relative">
                <Cube status={status} />
                {zone.hasIssue && (
                  <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </div>
              <p className="text-xs font-semibold text-neutral-800">{zone.label}</p>
              <p className="text-[11px] text-neutral-500">
                {zone.available}/{zone.total} available
              </p>
            </button>
          );
        })}
      </div>
      {selectedZone && (
        <button
          onClick={() => onSelectZone(null)}
          className="mt-4 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-white"
        >
          ← Show all zones
        </button>
      )}
    </div>
  );
}
