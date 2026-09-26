import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { computeDashboardStats } from "@/lib/dashboardStats";
import { computeStudyStats } from "@/lib/studyStats";
import StatTile from "@/components/StatTile";
import ScanQrButton from "@/components/ScanQrButton";
import LiveRefresh from "@/components/LiveRefresh";
import StudentAnalytics, { type HistoryRow } from "./StudentAnalytics";
import Heatmap from "@/components/Heatmap";
import DistributionBars from "@/components/DistributionBars";
import StudyTimer from "./StudyTimer";
import StudyTrendChart from "./StudyTrendChart";
import {
  SESSION_PURPOSE_LABELS,
  STUDY_CATEGORY_LABELS,
  type Session,
  type StudyActivity,
} from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*, charging_points(code, floors(name))")
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false });

  type SessionWithPoint = Session & {
    charging_points: { code: string; floors: { name: string } | null } | null;
  };
  const historyRows: HistoryRow[] = ((sessions as SessionWithPoint[]) ?? []).map((s) => ({
    id: s.id,
    code: s.charging_points?.code ?? "—",
    floor: s.charging_points?.floors?.name ?? "",
    purpose: s.purpose,
    started_at: s.started_at,
    ended_at: s.ended_at,
  }));

  const stats = computeDashboardStats((sessions as Session[]) ?? []);

  // Study & work tracking is a student-only feature — librarians/admins
  // don't get it on their dashboard.
  const isStudent = profile?.role === "student";
  let studyStats = null;
  if (isStudent) {
    const { data: studyActivities } = await supabase
      .from("study_activities")
      .select("*")
      .eq("user_id", user!.id)
      .order("started_at", { ascending: false });

    studyStats = computeStudyStats((studyActivities as StudyActivity[]) ?? []);
  }

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
      <LiveRefresh table="sessions" filter={`user_id=eq.${user!.id}`} />
      <ScanQrButton className="mb-6" />
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
        <DistributionBars
          items={Object.entries(stats.purposeCounts).map(([key, count]) => ({
            label: SESSION_PURPOSE_LABELS[key as keyof typeof SESSION_PURPOSE_LABELS],
            value: count,
          }))}
        />
      </div>

      <StudentAnalytics sessions={historyRows} />

      {/* Study & work — students only ----------------------------------- */}
      {isStudent && studyStats && (
        <>
          <h1 className="mt-12 mb-4 text-xl font-semibold">Study &amp; work</h1>
          <p className="mb-4 text-sm text-neutral-500">
            Track DSA, system design, and other study or work time —
            independent of charging, so you can log it whenever you&apos;re
            working.
          </p>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <StudyTimer activeActivity={studyStats.activeActivity} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Total study hours" value={studyStats.totalHours.toFixed(1)} />
            <StatTile label="Sessions" value={String(studyStats.sessionCount)} />
            <StatTile
              label="Avg. session"
              value={`${Math.round(studyStats.avgSessionMinutes)} min`}
            />
            <StatTile label="Study streak" value={`${studyStats.currentStreak}d`} />
          </div>

          <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-neutral-700">
              Where your time goes
            </h2>
            <DistributionBars
              items={Object.entries(studyStats.categoryMinutes).map(([key, minutes]) => ({
                label: STUDY_CATEGORY_LABELS[key as keyof typeof STUDY_CATEGORY_LABELS],
                value: Math.round((minutes / 60) * 10) / 10,
              }))}
            />
            <p className="mt-2 text-xs text-neutral-400">Hours per category, all time.</p>
          </div>

          <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-neutral-700">
              Last 14 days
            </h2>
            <StudyTrendChart data={studyStats.dailyTrend} />
          </div>

        </>
      )}
    </div>
  );
}
