"use client";

import { useEffect } from "react";
import { useRealtimeChargingPoints } from "@/lib/useRealtimeChargingPoints";
import PortPanel from "./PortPanel";
import type { ChargingPoint, Session } from "@/lib/types";

interface Props {
  qrCode: string;
  initialPoints: ChargingPoint[];
  portActiveSessions: Record<string, Session | null>;
  myActiveSession: Session | null;
  myUserId: string;
}

export default function StationLive({
  qrCode,
  initialPoints,
  portActiveSessions,
  myActiveSession,
  myUserId,
}: Props) {
  const points = useRealtimeChargingPoints(
    initialPoints,
    `qr_code=eq.${qrCode}`
  );

  // A "Scan" link from the floor view points at this same station page but
  // with #port-<code>, so the specific port that was "scanned" scrolls
  // into view and flashes once — every port still feels individually
  // reachable. Done imperatively (no React state) since it's a one-shot
  // CSS animation triggered by a browser-only API, not derived UI state.
  useEffect(() => {
    const hash = window.location.hash.replace("#port-", "");
    if (!hash) return;
    const el = document.getElementById(`port-${hash}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("animate-flash-highlight", "rounded-xl");
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {points.map((point) => (
        <div key={point.id} id={`port-${point.code}`}>
          <PortPanel
            point={point}
            qrCode={qrCode}
            portActiveSession={portActiveSessions[point.id] ?? null}
            myActiveSession={myActiveSession}
            myUserId={myUserId}
          />
        </div>
      ))}
    </div>
  );
}
