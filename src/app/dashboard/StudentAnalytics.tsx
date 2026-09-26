"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  differenceInMinutes,
  eachDayOfInterval,
  format,
  formatISO,
  startOfDay,
  subDays,
} from "date-fns";
import DistributionBars from "@/components/DistributionBars";
import StatTile from "@/components/StatTile";
import { SESSION_PURPOSE_LABELS, type SessionPurpose } from "@/lib/types";

export interface HistoryRow {
  id: string;
  code: string;
  floor: string;
  purpose: SessionPurpose;
  started_at: string;
  ended_at: string | null;
}

const PAGE_SIZE = 10;

function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m} min`;
}

function BarPanel({
  title,
  note,
  data,
  xKey,
  yKey,
  unit,
  interval,
}: {
  title: string;
  note?: string;
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  unit: string;
  interval: number;
}) {
  const empty = data.every((d) => !d[yKey]);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-neutral-700">{title}</h3>
      {empty ? (
        <p className="py-10 text-center text-sm text-neutral-400">
          No charging sessions yet.
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e1e0d9" />
              <XAxis
                dataKey={xKey}
                interval={interval}
                tick={{ fill: "#898781", fontSize: 11 }}
                axisLine={{ stroke: "#c3c2b7" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#898781", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "#f0efec" }}
                contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 12 }}
                formatter={(value) => [`${value} ${unit}`, ""]}
                separator=""
              />
              <Bar dataKey={yKey} fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {note && <p className="mt-2 text-xs text-neutral-400">{note}</p>}
    </div>
  );
}

export default function StudentAnalytics({ sessions }: { sessions: HistoryRow[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const a = useMemo(() => {
    const today = startOfDay(new Date());
    const dayMinutes = new Map<string, number>();
    const hourCounts = Array.from({ length: 24 }, () => 0);
    const portCounts = new Map<string, number>();
    const floorMinutes = new Map<string, number>();
    let weekMinutes = 0;
    let longest = 0;
    const weekStart = subDays(today, 6);

    for (const s of sessions) {
      const start = new Date(s.started_at);
      hourCounts[start.getHours()]++;
      portCounts.set(s.code, (portCounts.get(s.code) ?? 0) + 1);
      if (!s.ended_at) continue;

      const minutes = Math.max(0, differenceInMinutes(new Date(s.ended_at), start));
      const key = formatISO(startOfDay(start), { representation: "date" });
      dayMinutes.set(key, (dayMinutes.get(key) ?? 0) + minutes);
      floorMinutes.set(s.floor, (floorMinutes.get(s.floor) ?? 0) + minutes);
      if (start >= weekStart) weekMinutes += minutes;
      longest = Math.max(longest, minutes);
    }

    const dailyTrend = eachDayOfInterval({ start: subDays(today, 13), end: today }).map(
      (d) => {
        const key = formatISO(d, { representation: "date" });
        return {
          label: format(d, "MMM d"),
          minutes: dayMinutes.get(key) ?? 0,
        };
      }
    );
    const byHour = hourCounts.map((sessionsAtHour, h) => ({
      hour: `${h}:00`,
      sessions: sessionsAtHour,
    }));
    const topPorts = [...portCounts.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
    const floors = [...floorMinutes.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([label, minutes]) => ({
        label,
        value: Math.round((minutes / 60) * 10) / 10,
      }));

    return { dailyTrend, byHour, topPorts, floors, weekMinutes, longest };
  }, [sessions]);

  const active = sessions.find((s) => !s.ended_at);

  return (
    <div>
      <h1 className="mt-12 mb-1 text-xl font-semibold">Analytics</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Your charging usage. Updates live as you start and end sessions.
      </p>

      {active && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          🔌 Charging now on <span className="font-mono font-medium">{active.code}</span>{" "}
          ({active.floor}) — since{" "}
          <span suppressHydrationWarning>
            {format(new Date(active.started_at), "h:mm a")}
          </span>
          .
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile
          label="Last 7 days"
          value={`${(a.weekMinutes / 60).toFixed(1)} h`}
          sub="charging time"
        />
        <StatTile
          label="Longest session"
          value={formatDuration(a.longest)}
        />
        <StatTile
          label="Floors used"
          value={String(a.floors.length)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarPanel
          title="Charging time — last 14 days"
          data={a.dailyTrend}
          xKey="label"
          yKey="minutes"
          unit="min"
          interval={1}
          note="Minutes of completed sessions per day."
        />
        <BarPanel
          title="When you charge"
          data={a.byHour}
          xKey="hour"
          yKey="sessions"
          unit="sessions"
          interval={2}
          note="Sessions started, by hour of day."
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-700">Your top ports</h3>
          {a.topPorts.length ? (
            <DistributionBars items={a.topPorts} />
          ) : (
            <p className="text-sm text-neutral-400">No sessions yet.</p>
          )}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-700">Hours by floor</h3>
          {a.floors.length ? (
            <DistributionBars items={a.floors} />
          ) : (
            <p className="text-sm text-neutral-400">No completed sessions yet.</p>
          )}
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Charging history</h2>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {sessions.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">
            No sessions yet. Scan a socket&apos;s QR code and tap Mark Occupied to
            start one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Port</th>
                  <th className="px-4 py-2 font-medium">Purpose</th>
                  <th className="px-4 py-2 font-medium">Started</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, visible).map((s) => (
                  <tr key={s.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2">
                      <p className="font-mono">{s.code}</p>
                      <p className="text-xs text-neutral-500">{s.floor}</p>
                    </td>
                    <td className="px-4 py-2 text-neutral-700">
                      {SESSION_PURPOSE_LABELS[s.purpose]}
                    </td>
                    <td className="px-4 py-2 text-neutral-700" suppressHydrationWarning>
                      {format(new Date(s.started_at), "MMM d, h:mm a")}
                    </td>
                    <td className="px-4 py-2">
                      {s.ended_at ? (
                        <span suppressHydrationWarning>
                          {formatDuration(
                            Math.max(
                              0,
                              differenceInMinutes(new Date(s.ended_at), new Date(s.started_at))
                            )
                          )}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          In progress
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {sessions.length > visible && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="w-full border-t border-neutral-100 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50"
          >
            Show more ({sessions.length - visible} older)
          </button>
        )}
      </div>
    </div>
  );
}
