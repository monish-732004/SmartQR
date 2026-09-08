import { createClient } from "@/lib/supabase/server";
import { computeDashboardStats } from "@/lib/dashboardStats";
import StatTile from "@/components/StatTile";
import Heatmap from "@/components/Heatmap";
import { SESSION_PURPOSE_LABELS, type Session } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false });

  const stats = computeDashboardStats((sessions as Session[]) ?? []);

  let mostUsedLabel = "—";
  if (stats.mostUsedPointId) {
    const { data: point } = await supabase
      .from("charging_points")
      .select("code")
      .eq("id", stats.mostUsedPointId)
      .single();
    mostUsedLabel = point?.code ?? "—";
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Total charging hours"
          value={stats.totalHours.toFixed(1)}
        />
        <StatTile label="Sessions" value={String(stats.sessionCount)} />
        <StatTile
          label="Avg. session"
          value={`${Math.round(stats.avgSessionMinutes)} min`}
        />
        <StatTile label="Active days" value={String(stats.activeDays)} />
        <StatTile label="Most-used point" value={mostUsedLabel} />
      </div>

      {stats.currentStreak > 0 && (
        <p className="mt-4 inline-block rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700">
          🔥 {stats.currentStreak}-day library streak
        </p>
      )}

      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">
          Activity over the last 26 weeks
        </h2>
        <Heatmap dayCounts={stats.dayCounts} />
      </div>

      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">
          Sessions by purpose
        </h2>
        <div className="flex flex-col gap-2">
          {Object.entries(stats.purposeCounts).map(([key, count]) => {
            const max = Math.max(1, ...Object.values(stats.purposeCounts));
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="w-32 text-neutral-600">
                  {SESSION_PURPOSE_LABELS[key as keyof typeof SESSION_PURPOSE_LABELS]}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / max) * 100}%`,
                      backgroundColor: "#2a78d6",
                    }}
                  />
                </div>
                <span className="w-6 text-right tabular-nums text-neutral-500">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
