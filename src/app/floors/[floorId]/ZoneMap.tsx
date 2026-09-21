"use client";

import { zonesFrom } from "@/lib/zones";
import type { ChargingPoint } from "@/lib/types";

function tileStyle(ratio: number): string {
  if (ratio >= 0.5) return "border-emerald-300 bg-emerald-50 hover:border-emerald-400";
  if (ratio > 0) return "border-amber-300 bg-amber-50 hover:border-amber-400";
  return "border-neutral-300 bg-neutral-100 hover:border-neutral-400";
}

export default function ZoneMap({
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
    <div className="mb-6">
      <div
        className="rounded-xl border border-neutral-300 p-4"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          backgroundColor: "#fafaf9",
        }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {zones.map((zone) => {
            const ratio = zone.total === 0 ? 0 : zone.available / zone.total;
            const selected = selectedZone === zone.label;
            return (
              <button
                key={zone.label}
                onClick={() => onSelectZone(selected ? null : zone.label)}
                className={`relative rounded-md border-[3px] p-3 text-left transition-all duration-150 ${tileStyle(
                  ratio
                )} ${selected ? "ring-2 ring-violet-500 ring-offset-2" : ""}`}
              >
                {zone.hasIssue && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                )}
                <p className="text-xs font-semibold text-neutral-800">{zone.label}</p>
                <p className="mt-1 text-lg font-bold text-neutral-900">
                  {zone.available}
                  <span className="text-xs font-normal text-neutral-500">/{zone.total}</span>
                </p>
                <p className="text-[11px] text-neutral-500">available</p>
              </button>
            );
          })}
        </div>
      </div>
      {selectedZone && (
        <button
          onClick={() => onSelectZone(null)}
          className="mt-2 rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          ← Show all zones
        </button>
      )}
    </div>
  );
}
