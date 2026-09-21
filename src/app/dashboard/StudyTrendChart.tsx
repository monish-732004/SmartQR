"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

export default function StudyTrendChart({
  data,
}: {
  data: { date: string; minutes: number }[];
}) {
  const chartData = data.map((d) => ({ ...d, label: format(parseISO(d.date), "MMM d") }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e1e0d9" />
          <XAxis
            dataKey="label"
            interval={1}
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
            contentStyle={{
              borderRadius: 8,
              borderColor: "#e1e0d9",
              fontSize: 12,
            }}
            formatter={(value) => [`${value} min`, "Studied"]}
          />
          <Bar dataKey="minutes" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
