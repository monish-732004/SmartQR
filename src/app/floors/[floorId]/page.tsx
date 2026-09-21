import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isStaff } from "@/lib/auth";
import type { ChargingPoint, Floor } from "@/lib/types";
import FloorPointsLive from "./FloorPointsLive";

export default async function FloorDetailPage({
  params,
}: PageProps<"/floors/[floorId]">) {
  const { floorId } = await params;
  const supabase = await createClient();
  const profile = await getProfile();
  const staff = isStaff(profile);

  // Same scoping as the /floors list: a librarian only ever sees their
  // own floor's section here, not the whole library.
  if (profile?.role === "librarian" && profile.floor_id && profile.floor_id !== floorId) {
    redirect(`/floors/${profile.floor_id}`);
  }

  const { data: floor } = await supabase
    .from("floors")
    .select("*")
    .eq("id", floorId)
    .single();

  if (!floor) notFound();

  const { data: points } = await supabase
    .from("charging_points")
    .select("*")
    .eq("floor_id", floorId)
    .order("code");

  const allPoints = (points as ChargingPoint[]) ?? [];

  return (
    <div>
      <Link
        href="/floors"
        className="text-sm text-neutral-500 transition-colors hover:text-violet-700"
      >
        ← Floors
      </Link>
      <div className="mt-2 mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {(floor as Floor).name}
        </h1>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <p className="mb-5 text-sm text-neutral-500">
        {staff ? (
          <>
            Each card is one socket. Toggle its status directly below — no
            need to scan.
          </>
        ) : (
          <>
            Each card is one socket, with its own QR code. The{" "}
            <strong className="text-neutral-700">Scan</strong> button shows
            that socket&apos;s QR code — scan it with your phone camera to
            get in and use it.
          </>
        )}
      </p>

      <FloorPointsLive floorId={floorId} initialPoints={allPoints} staff={staff} />
    </div>
  );
}
