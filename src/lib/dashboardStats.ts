import type { Session, SessionPurpose } from "@/lib/types";
import {
  differenceInMinutes,
  eachDayOfInterval,
  formatISO,
  isSameDay,
  startOfDay,
  subDays,
} from "date-fns";

export interface DashboardStats {
  totalHours: number;
  sessionCount: number;
  avgSessionMinutes: number;
  activeDays: number;
  mostUsedPointId: string | null;
  currentStreak: number;
  purposeCounts: Record<SessionPurpose, number>;
  dayCounts: Map<string, number>; // ISO date -> session count, for the heatmap
}

export function computeDashboardStats(sessions: Session[]): DashboardStats {
  const ended = sessions.filter((s) => s.ended_at);
  const totalMinutes = ended.reduce(
    (sum, s) => sum + differenceInMinutes(new Date(s.ended_at!), new Date(s.started_at)),
    0
  );

  const pointCounts = new Map<string, number>();
  for (const s of sessions) {
    pointCounts.set(s.point_id, (pointCounts.get(s.point_id) ?? 0) + 1);
  }
  let mostUsedPointId: string | null = null;
  let maxCount = 0;
  for (const [pointId, count] of pointCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedPointId = pointId;
    }
  }

  const dayCounts = new Map<string, number>();
  const activeDaySet = new Set<string>();
  for (const s of sessions) {
    const key = formatISO(startOfDay(new Date(s.started_at)), { representation: "date" });
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    activeDaySet.add(key);
  }

  const purposeCounts: Record<SessionPurpose, number> = {
    charging_only: 0,
    study: 0,
    project_work: 0,
    exam_prep: 0,
  };
  for (const s of sessions) purposeCounts[s.purpose]++;

  // Current streak: count back from today while each day has >=1 session.
  // A gap of "today has none yet" doesn't break it (session may not have
  // happened yet today), but any earlier gap does.
  let currentStreak = 0;
  let cursor = startOfDay(new Date());
  const todayKey = formatISO(cursor, { representation: "date" });
  if (!activeDaySet.has(todayKey)) cursor = subDays(cursor, 1);
  while (activeDaySet.has(formatISO(cursor, { representation: "date" }))) {
    currentStreak++;
    cursor = subDays(cursor, 1);
  }

  return {
    totalHours: totalMinutes / 60,
    sessionCount: sessions.length,
    avgSessionMinutes: ended.length ? totalMinutes / ended.length : 0,
    activeDays: activeDaySet.size,
    mostUsedPointId,
    currentStreak,
    purposeCounts,
    dayCounts,
  };
}

export function buildHeatmapWeeks(dayCounts: Map<string, number>, weeks = 26) {
  const end = startOfDay(new Date());
  const start = subDays(end, weeks * 7 - 1);
  const days = eachDayOfInterval({ start, end });

  // Pad to a full week grid starting on Sunday.
  const leadingBlanks = days[0].getDay();
  const cells: { date: Date | null; count: number }[] = [
    ...Array.from({ length: leadingBlanks }, () => ({ date: null, count: 0 })),
    ...days.map((date) => ({
      date,
      count: dayCounts.get(formatISO(date, { representation: "date" })) ?? 0,
    })),
  ];

  const columns: { date: Date | null; count: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    columns.push(cells.slice(i, i + 7));
  }
  return columns;
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
