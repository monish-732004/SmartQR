"use client";

import Link from "next/link";
import { useRealtimeChargingPoints } from "@/lib/useRealtimeChargingPoints";
import StatTile from "@/components/StatTile";
import type { ChargingPoint, Floor } from "@/lib/types";

export default function LibrarianOverviewLive({
  floors,
  initialPoints,
}: {
  floors: Floor[];
  initialPoints: ChargingPoint[];
}) {
  const all = useRealtimeChargingPoints(initialPoints);

  const counts = {
    available: all.filter((p) => p.availability_status === "available").length,
    occupied: all.filter((p) => p.availability_status === "occupied").length,
    reserved: all.filter((p) => p.availability_status === "reserved").length,
    working: all.filter((p) => p.health_status === "working").length,
    reported_issue: all.filter((p) => p.health_status === "reported_issue").length,
    maintenance: all.filter((p) => p.health_status === "maintenance").length,
  };

  const byFloor = new Map<string, ChargingPoint[]>();
  for (const p of all) {
    const list = byFloor.get(p.floor_id) ?? [];
    list.push(p);
    byFloor.set(p.floor_id, list);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        <StatTile label="Available" value={String(counts.available)} />
        <StatTile label="Occupied" value={String(counts.occupied)} />
        <StatTile label="Reserved" value={String(counts.reserved)} />
        <StatTile label="Working" value={String(counts.working)} />
        <StatTile label="Reported issue" value={String(counts.reported_issue)} />
        <StatTile label="Maintenance" value={String(counts.maintenance)} />
      </div>

      <p className="mt-2 text-xs text-neutral-400">Live — updates automatically.</p>

      <h2 className="mt-8 mb-3 text-sm font-medium text-neutral-700">By floor</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {floors.map((floor) => {
          const pts = byFloor.get(floor.id) ?? [];
          const issues = pts.filter((p) => p.health_status !== "working").length;
          return (
            <Link
              key={floor.id}
              href={`/librarian/floors/${floor.id}`}
              className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400"
            >
              <h3 className="font-medium">{floor.name}</h3>
              <p className="mt-1 text-sm text-neutral-500">{pts.length} points</p>
              {issues > 0 && (
                <p className="mt-2 text-sm font-medium text-red-700">
                  {issues} need attention
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
