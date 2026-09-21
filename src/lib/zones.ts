import type { ChargingPoint } from "@/lib/types";

export interface Zone {
  label: string;
  total: number;
  available: number;
  hasIssue: boolean;
}

export function zonesFrom(points: ChargingPoint[]): Zone[] {
  const byLabel = new Map<string, ChargingPoint[]>();
  for (const p of points) {
    const label = p.label ?? "Other";
    const list = byLabel.get(label) ?? [];
    list.push(p);
    byLabel.set(label, list);
  }
  return [...byLabel.entries()]
    .map(([label, pts]) => ({
      label,
      total: pts.length,
      available: pts.filter((p) => p.availability_status === "available").length,
      hasIssue: pts.some((p) => p.health_status !== "working"),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
