"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-runs the current server page whenever a row in `table` changes, so
 * server-rendered lists (who's using a socket, a student's charging history)
 * stay live without a manual refresh. Renders nothing. RLS still decides
 * which changes this subscriber receives.
 */
export default function LiveRefresh({
  table,
  filter,
}: {
  table: string;
  filter?: string;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-refresh:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => {
          // Coalesce bursts (start + status flip) into one refresh.
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 300);
        }
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [table, filter, router]);

  return null;
}
