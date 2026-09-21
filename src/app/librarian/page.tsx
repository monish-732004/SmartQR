import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { ChargingPoint, Floor } from "@/lib/types";
import LibrarianOverviewLive from "./LibrarianOverviewLive";

export default async function LibrarianOverviewPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const scopedFloorId = !isAdmin(profile) ? profile?.floor_id ?? null : null;

  let floorsQuery = supabase.from("floors").select("*").order("sort_order");
  if (scopedFloorId) floorsQuery = floorsQuery.eq("id", scopedFloorId);
  const { data: floors } = await floorsQuery;

  let pointsQuery = supabase.from("charging_points").select("*");
  if (scopedFloorId) pointsQuery = pointsQuery.eq("floor_id", scopedFloorId);
  const { data: points } = await pointsQuery;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">
        {scopedFloorId ? `${(floors as Floor[])?.[0]?.name ?? "Your floor"} — live overview` : "Live overview"}
      </h1>

      {profile && !profile.has_password && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-sm text-violet-800">
            🔑 Set a password so you don&apos;t need an email link every time
            you sign in.
          </p>
          <Link
            href="/account/set-password"
            className="whitespace-nowrap rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
          >
            Set password
          </Link>
        </div>
      )}

      <LibrarianOverviewLive
        floors={(floors as Floor[]) ?? []}
        initialPoints={(points as ChargingPoint[]) ?? []}
      />
    </div>
  );
}
