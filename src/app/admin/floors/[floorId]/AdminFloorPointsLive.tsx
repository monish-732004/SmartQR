"use client";

import { useRealtimeChargingPoints } from "@/lib/useRealtimeChargingPoints";
import PointStatusRow from "./PointStatusRow";
import type { ChargingPoint } from "@/lib/types";

export default function AdminFloorPointsLive({
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
      {stations.map(([qrCode, ports]) => (
        <div key={qrCode} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2">
            <p className="font-mono text-sm font-medium">{qrCode}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Port</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Availability</th>
                <th className="px-4 py-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {ports
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((p) => (
                  <PointStatusRow key={p.id} point={p} />
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
