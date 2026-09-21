"use client";

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

  return (
    <div className="flex flex-col gap-3">
      {points.map((point) => (
        <PortPanel
          key={point.id}
          point={point}
          qrCode={qrCode}
          portActiveSession={portActiveSessions[point.id] ?? null}
          myActiveSession={myActiveSession}
          myUserId={myUserId}
        />
      ))}
    </div>
  );
}
