"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRealtimeChargingPoints } from "@/lib/useRealtimeChargingPoints";
import { AvailabilityBadge, HealthBadge } from "@/components/StatusBadges";
import { correctPointStatus } from "@/app/admin/actions";
import ZoneMap from "./ZoneMap";
import type { ChargingPoint } from "@/lib/types";

function OccupancyToggle({ point }: { point: ChargingPoint }) {
  const [pending, startTransition] = useTransition();
  const occupied = point.availability_status === "occupied";

  function toggle() {
    startTransition(() => {
      correctPointStatus(point.id, occupied ? "available" : "occupied", null);
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm transition-all duration-150 hover:scale-105 disabled:opacity-50 ${
        occupied ? "bg-neutral-500" : "bg-emerald-600"
      }`}
    >
      {pending ? "Saving…" : occupied ? "Mark available" : "Mark occupied"}
    </button>
  );
}

const ACCENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-cyan-400",
  "from-orange-400 to-amber-400",
  "from-emerald-500 to-teal-400",
  "from-rose-500 to-pink-400",
];

export default function FloorPointsLive({
  floorId,
  initialPoints,
  staff = false,
  signedPaths,
}: {
  floorId: string;
  initialPoints: ChargingPoint[];
  staff?: boolean;
  signedPaths: Record<string, string>;
}) {
  const points = useRealtimeChargingPoints(initialPoints, `floor_id=eq.${floorId}`);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const visiblePoints = selectedZone
    ? points.filter((p) => (p.label ?? "Other") === selectedZone)
    : points;

  const byQrCode = new Map<string, ChargingPoint[]>();
  for (const p of visiblePoints) {
    const list = byQrCode.get(p.qr_code) ?? [];
    list.push(p);
    byQrCode.set(p.qr_code, list);
  }
  const stations = [...byQrCode.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <ZoneMap points={points} selectedZone={selectedZone} onSelectZone={setSelectedZone} />

      <div className="flex flex-col gap-4">
        {stations.map(([qrCode, ports], i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          return (
            <div
              key={qrCode}
              className="animate-pop-in overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className={`h-1 bg-gradient-to-r ${accent}`} />
              <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/70 px-4 py-2">
                <p className="font-mono text-sm font-semibold text-neutral-900">
                  {qrCode}
                </p>
                <p className="text-xs text-neutral-500">
                  {ports.length} port{ports.length === 1 ? "" : "s"}
                </p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {ports
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((p) => (
                      <tr
                        key={p.id}
                        className="group border-t border-neutral-100 transition-colors first:border-t-0 hover:bg-violet-50/50"
                      >
                        <td className="px-4 py-2 font-mono text-neutral-900">
                          {p.code}
                        </td>
                        <td className="px-4 py-2 text-neutral-600">
                          {p.label ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <AvailabilityBadge status={p.availability_status} />
                        </td>
                        <td className="px-4 py-2">
                          <HealthBadge status={p.health_status} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          {staff ? (
                            <OccupancyToggle point={p} />
                          ) : (
                            <Link
                              href={signedPaths[p.qr_code] ?? "#"}
                              className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${accent} px-3 py-1 text-xs font-medium text-white opacity-90 shadow-sm transition-all duration-150 hover:scale-105 hover:opacity-100`}
                            >
                              📷 Scan
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <p className="text-center text-xs text-neutral-400">
          Live — updates automatically as students scan and admins correct
          statuses.
        </p>
      </div>
    </div>
  );
}
