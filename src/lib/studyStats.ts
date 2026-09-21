import type { StudyActivity, StudyCategory } from "@/lib/types";
import {
  differenceInMinutes,
  eachDayOfInterval,
  formatISO,
  startOfDay,
  subDays,
} from "date-fns";

export interface StudyStats {
  totalHours: number;
  sessionCount: number;
  avgSessionMinutes: number;
  currentStreak: number;
  categoryMinutes: Record<StudyCategory, number>;
  dayMinutes: Map<string, number>; // ISO date -> minutes studied, for the heatmap
  dailyTrend: { date: string; minutes: number }[]; // last 14 days, for a bar chart
  activeActivity: StudyActivity | null;
}

const EMPTY_CATEGORY_MINUTES: Record<StudyCategory, number> = {
  dsa: 0,
  system_design: 0,
  aptitude: 0,
  interview_prep: 0,
  reading: 0,
  other: 0,
};

export function computeStudyStats(activities: StudyActivity[]): StudyStats {
  const activeActivity = activities.find((a) => !a.ended_at) ?? null;
  const ended = activities.filter((a) => a.ended_at);

  const totalMinutes = ended.reduce(
    (sum, a) => sum + differenceInMinutes(new Date(a.ended_at!), new Date(a.started_at)),
    0
  );

  const categoryMinutes: Record<StudyCategory, number> = { ...EMPTY_CATEGORY_MINUTES };
  const dayMinutes = new Map<string, number>();
  const activeDaySet = new Set<string>();

  for (const a of ended) {
    const minutes = differenceInMinutes(new Date(a.ended_at!), new Date(a.started_at));
    categoryMinutes[a.category] += minutes;

    const key = formatISO(startOfDay(new Date(a.started_at)), { representation: "date" });
    dayMinutes.set(key, (dayMinutes.get(key) ?? 0) + minutes);
    activeDaySet.add(key);
  }

  // Current streak: count back from today while each day has >=1 minute
  // studied. A gap of "today has none yet" doesn't break it, any earlier
  // gap does — same logic as the charging-session streak.
  let currentStreak = 0;
  let cursor = startOfDay(new Date());
  const todayKey = formatISO(cursor, { representation: "date" });
  if (!activeDaySet.has(todayKey)) cursor = subDays(cursor, 1);
  while (activeDaySet.has(formatISO(cursor, { representation: "date" }))) {
    currentStreak++;
    cursor = subDays(cursor, 1);
  }

  const trendEnd = startOfDay(new Date());
  const trendStart = subDays(trendEnd, 13);
  const dailyTrend = eachDayOfInterval({ start: trendStart, end: trendEnd }).map((date) => {
    const key = formatISO(date, { representation: "date" });
    return { date: key, minutes: dayMinutes.get(key) ?? 0 };
  });

  return {
    totalHours: totalMinutes / 60,
    sessionCount: ended.length,
    avgSessionMinutes: ended.length ? totalMinutes / ended.length : 0,
    currentStreak,
    categoryMinutes,
    dayMinutes,
    dailyTrend,
    activeActivity,
  };
}
