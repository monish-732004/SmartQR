"use client";

import Link from "next/link";
import { useRealtimeChargingPoints } from "@/lib/useRealtimeChargingPoints";
import { AvailabilityBadge, HealthBadge } from "@/components/StatusBadges";
import type { ChargingPoint } from "@/lib/types";

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
}: {
  floorId: string;
  initialPoints: ChargingPoint[];
}) {
  const points = useRealtimeChargingPoints(initialPoints, `floor_id=eq.${floorId}`);

  const byQrCode = new Map<string, ChargingPoint[]>();
  for (const p of points) {
    const list = byQrCode.get(p.qr_code) ?? [];
    list.push(p);
    byQrCode.set(p.qr_code, list);
  }
  const stations = [...byQrCode.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
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
                        <Link
                          href={`/scan/${encodeURIComponent(p.qr_code)}?port=${encodeURIComponent(p.code)}`}
                          className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${accent} px-3 py-1 text-xs font-medium text-white opacity-90 shadow-sm transition-all duration-150 hover:scale-105 hover:opacity-100`}
                        >
                          📷 Scan
                        </Link>
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
  );
}
