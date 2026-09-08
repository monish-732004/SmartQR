"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChargingPoint } from "@/lib/types";

type Patch = ChargingPoint | null; // null means "deleted"

function applyPatches(
  initial: ChargingPoint[],
  patches: Record<string, Patch>
): ChargingPoint[] {
  const byId = new Map(initial.map((p) => [p.id, p]));
  for (const [id, patch] of Object.entries(patches)) {
    if (patch === null) byId.delete(id);
    else byId.set(id, patch);
  }
  return [...byId.values()];
}

function signature(points: ChargingPoint[]): string {
  return points.map((p) => `${p.id}:${p.availability_status}:${p.health_status}`).join("|");
}

/**
 * Keeps a list of charging points live: subscribes to postgres_changes on
 * charging_points so a status flip made by anyone (a student scanning a
 * port, a librarian correcting a status) shows up here without a refresh.
 * `filter` scopes the subscription (e.g. `floor_id=eq.<id>`) — omit it to
 * receive every point, for library-wide views like the admin overview.
 */
export function useRealtimeChargingPoints(
  initial: ChargingPoint[],
  filter?: string
): ChargingPoint[] {
  const [patches, setPatches] = useState<Record<string, Patch>>({});

  // When the server hands us fresh initial data (navigation, a server
  // action's revalidation), it already supersedes any patches we'd
  // accumulated — drop them. This adjusts state during render rather than
  // in an effect, per React's guidance for resetting state on prop change.
  const initialSig = signature(initial);
  const [prevSig, setPrevSig] = useState(initialSig);
  if (initialSig !== prevSig) {
    setPrevSig(initialSig);
    setPatches({});
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`charging_points:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "charging_points",
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: string }).id;
            setPatches((prev) => ({ ...prev, [oldId]: null }));
            return;
          }
          const updated = payload.new as ChargingPoint;
          setPatches((prev) => ({ ...prev, [updated.id]: updated }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  return applyPatches(initial, patches);
}
