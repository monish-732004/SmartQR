import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { ChargingPoint, Floor } from "@/lib/types";
import AdminFloorPointsLive from "./AdminFloorPointsLive";

export default async function AdminFloorDetailPage({
  params,
}: PageProps<"/admin/floors/[floorId]">) {
  const { floorId } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  if (!isAdmin(profile) && profile?.floor_id !== floorId) {
    redirect("/admin");
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

  return (
    <div>
      <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
        ← Overview
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold">{(floor as Floor).name}</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Correct a port&apos;s status directly — e.g. after a physical round finds
        it empty even though it still shows Occupied. Updates go out live to
        everyone viewing this floor or the student app.
      </p>

      <AdminFloorPointsLive
        floorId={floorId}
        initialPoints={(points as ChargingPoint[]) ?? []}
      />
    </div>
  );
}
