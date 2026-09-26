"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PRESENCE_CHANNEL, type OnlineStudent } from "@/components/PresenceTracker";

/** Students with the app open right now (live), with a badge for those
 * currently charging. */
export default function OnlineStudents({ chargingUserIds }: { chargingUserIds: string[] }) {
  const [online, setOnline] = useState<OnlineStudent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_CHANNEL);

    const sync = () => {
      const state = channel.presenceState<OnlineStudent>();
      const list = Object.values(state)
        .map((metas) => metas[0])
        .filter(Boolean);
      list.sort((a, b) => a.name.localeCompare(b.name));
      setOnline(list);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const charging = new Set(chargingUserIds);

  return (
    <div className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-700">
        <span
          className={`h-2 w-2 rounded-full ${connected ? "animate-soft-pulse bg-emerald-500" : "bg-neutral-300"}`}
        />
        Online now ({online.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {online.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">
            {connected
              ? "No students have the app open right now."
              : "Connecting to live updates…"}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {online.map((s) => (
              <li key={s.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{s.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {s.registration_id ? `${s.registration_id} · ` : ""}
                    {s.email}
                  </p>
                </div>
                {charging.has(s.user_id) ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Charging
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    Online
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
