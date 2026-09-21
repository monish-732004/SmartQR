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

export default function PeakHoursChart({
  data,
}: {
  data: { hour: string; sessions: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e1e0d9" />
          <XAxis
            dataKey="hour"
            interval={2}
            tick={{ fill: "#898781", fontSize: 11 }}
            axisLine={{ stroke: "#c3c2b7" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#898781", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: "#f0efec" }}
            contentStyle={{
              borderRadius: 8,
              borderColor: "#e1e0d9",
              fontSize: 12,
            }}
            labelFormatter={(label) => `${label}:00`}
            formatter={(value) => [`${value}`, "Sessions started"]}
          />
          <Bar dataKey="sessions" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
