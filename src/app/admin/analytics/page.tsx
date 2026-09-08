import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import PeakHoursChart from "./PeakHoursChart";
import type { ChargingPoint, FaultReport, MaintenanceTicket, Session } from "@/lib/types";

// Point-level counts below this are shown as "< N" rather than an exact
// figure, so a single student's usage can't be singled out from analytics.
const K_ANON_THRESHOLD = 3;
const REPEAT_BREAKDOWN_THRESHOLD = 3;

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const scopedFloorId = !isAdmin(profile) ? profile?.floor_id ?? null : null;

  // sessions/fault_reports/maintenance_tickets are already floor-scoped by
  // RLS for a librarian (see 0008_floor_scoped_librarians.sql); charging_points
  // stays open for student browsing, so it needs an explicit filter here.
  let pointsQuery = supabase.from("charging_points").select("*, floors(name)");
  if (scopedFloorId) pointsQuery = pointsQuery.eq("floor_id", scopedFloorId);

  const [{ data: points }, { data: sessions }, { data: faultReports }, { data: tickets }] =
    await Promise.all([
      pointsQuery,
      supabase.from("sessions").select("*"),
      supabase.from("fault_reports").select("*"),
      supabase.from("maintenance_tickets").select("*"),
    ]);

  const allPoints = (points as (ChargingPoint & { floors: { name: string } | null })[]) ?? [];
  const allSessions = (sessions as Session[]) ?? [];
  const allFaultReports = (faultReports as FaultReport[]) ?? [];
  const allTickets = (tickets as MaintenanceTicket[]) ?? [];

  // Peak hour demand: count of session starts per hour of day, all-time.
  const hourCounts = new Array(24).fill(0);
  for (const s of allSessions) {
    hourCounts[new Date(s.started_at).getHours()]++;
  }
  const peakHoursData = hourCounts.map((sessions, hour) => ({
    hour: String(hour).padStart(2, "0"),
    sessions,
  }));

  // Usage ranking per point.
  const sessionsByPoint = new Map<string, number>();
  for (const s of allSessions) {
    sessionsByPoint.set(s.point_id, (sessionsByPoint.get(s.point_id) ?? 0) + 1);
  }
  const faultsByPoint = new Map<string, number>();
  for (const f of allFaultReports) {
    faultsByPoint.set(f.point_id, (faultsByPoint.get(f.point_id) ?? 0) + 1);
  }
  const ticketsByPoint = new Map<string, number>();
  for (const t of allTickets) {
    ticketsByPoint.set(t.point_id, (ticketsByPoint.get(t.point_id) ?? 0) + 1);
  }

  const ranked = allPoints
    .map((p) => ({
      point: p,
      sessionCount: sessionsByPoint.get(p.id) ?? 0,
      faultCount: faultsByPoint.get(p.id) ?? 0,
      ticketCount: ticketsByPoint.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  const maxSessions = Math.max(1, ...ranked.map((r) => r.sessionCount));
  const avgSessions =
    ranked.reduce((sum, r) => sum + r.sessionCount, 0) / (ranked.length || 1);
  const underutilized = ranked.filter(
    (r) => r.sessionCount < avgSessions * 0.5
  );
  const repeatOffenders = ranked.filter(
    (r) => r.ticketCount >= REPEAT_BREAKDOWN_THRESHOLD
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Analytics</h1>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">
          Peak hour demand (all-time session starts, by hour of day)
        </h2>
        <PeakHoursChart data={peakHoursData} />
      </div>

      {repeatOffenders.length > 0 && (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-medium text-red-800">
            Prioritize for replacement — repeat breakdowns
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-red-700">
            {repeatOffenders.map((r) => (
              <li key={r.point.id}>
                <span className="font-mono">{r.point.code}</span> —{" "}
                {r.ticketCount} maintenance events
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-medium text-neutral-700">
        Usage ranking (most to least used)
      </h2>
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        {ranked.map((r) => (
          <div key={r.point.id} className="flex items-center gap-3 text-sm">
            <span className="w-20 font-mono">{r.point.code}</span>
            <span className="w-24 truncate text-neutral-500">
              {r.point.floors?.name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(r.sessionCount / maxSessions) * 100}%`,
                  backgroundColor: "#2a78d6",
                }}
              />
            </div>
            <span className="w-16 text-right tabular-nums text-neutral-600">
              {r.sessionCount < K_ANON_THRESHOLD
                ? `< ${K_ANON_THRESHOLD}`
                : r.sessionCount}
            </span>
          </div>
        ))}
      </div>

      {underutilized.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-medium text-amber-800">
            Underutilized — consider relocating
          </h2>
          <p className="text-sm text-amber-700">
            {underutilized.map((r) => r.point.code).join(", ")}
          </p>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-medium text-neutral-700">
        Maintenance history
      </h2>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Point</th>
              <th className="px-4 py-2 font-medium">Total sessions</th>
              <th className="px-4 py-2 font-medium">Fault reports</th>
              <th className="px-4 py-2 font-medium">Maintenance events</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.point.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono">{r.point.code}</td>
                <td className="px-4 py-2 tabular-nums">
                  {r.sessionCount < K_ANON_THRESHOLD
                    ? `< ${K_ANON_THRESHOLD}`
                    : r.sessionCount}
                </td>
                <td className="px-4 py-2 tabular-nums">{r.faultCount}</td>
                <td className="px-4 py-2 tabular-nums">{r.ticketCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
