import { createClient } from "@/lib/supabase/server";
import { verifyCode } from "@/lib/qr";
import StationLive from "./StationLive";
import type { ChargingPoint, Session } from "@/lib/types";

export default async function StationPage({
  params,
  searchParams,
}: PageProps<"/s/[code]">) {
  const { code } = await params;
  const { sig } = await searchParams;
  const signature = typeof sig === "string" ? sig : "";

  const signatureValid = signature && verifyCode(code, signature);

  const supabase = await createClient();
  const { data: points } = await supabase
    .from("charging_points")
    .select("*, floors(name)")
    .eq("qr_code", code)
    .order("code");

  if (!signatureValid) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="mb-2 text-lg font-semibold text-red-800">
          Invalid QR code
        </h1>
        <p className="text-sm text-red-700">
          This link&apos;s signature doesn&apos;t match {code}. Please scan the
          physical QR code on the charging station instead of typing a URL.
        </p>
      </div>
    );
  }

  if (!points || points.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">Charging station not found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {code} doesn&apos;t exist in the system.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pointIds = points.map((p) => p.id);

  const { data: activeSessions } = await supabase
    .from("sessions")
    .select("*")
    .in("point_id", pointIds)
    .is("ended_at", null);

  const portActiveSessions: Record<string, Session | null> = {};
  for (const p of points) portActiveSessions[p.id] = null;
  let myActiveSession: Session | null = null;
  for (const s of (activeSessions as Session[]) ?? []) {
    portActiveSessions[s.point_id] = s;
    if (s.user_id === user!.id) myActiveSession = s;
  }

  // If the user's one active session is on a different port entirely
  // (not under this QR at all), we still need it to show the "you have
  // an active session elsewhere" guard.
  if (!myActiveSession) {
    const { data: elsewhere } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user!.id)
      .is("ended_at", null)
      .maybeSingle();
    myActiveSession = (elsewhere as Session | null) ?? null;
  }

  const p0 = points[0] as ChargingPoint & { floors: { name: string } | null };

  return (
    <div className="mx-auto max-w-md">
      <p className="text-xs text-neutral-500">{p0.floors?.name}</p>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 bg-clip-text font-mono text-3xl font-bold text-transparent">
          {code}
        </h1>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        {points.length} port{points.length === 1 ? "" : "s"} at this station —
        pick yours below.
      </p>

      <StationLive
        qrCode={code}
        initialPoints={points as ChargingPoint[]}
        portActiveSessions={portActiveSessions}
        myActiveSession={myActiveSession}
        myUserId={user!.id}
      />
    </div>
  );
}
