import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { ChargingPoint, Floor } from "@/lib/types";

const ACCENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-cyan-400",
  "from-orange-400 to-amber-400",
  "from-emerald-500 to-teal-400",
];

export default async function FloorsPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  // Librarians are scoped to their own floor everywhere else in the app
  // (RLS on sessions/reports, explicit filters on QR codes/analytics) —
  // this shared browse page is the one exception, since it's built for
  // students to see every floor. Admins still see everything.
  const scopedFloorId = profile?.role === "librarian" ? profile.floor_id : null;

  let floorsQuery = supabase.from("floors").select("*").order("sort_order");
  if (scopedFloorId) floorsQuery = floorsQuery.eq("id", scopedFloorId);
  const { data: floors } = await floorsQuery;

  const { data: points } = await supabase
    .from("charging_points")
    .select("id, floor_id, availability_status, health_status");

  const byFloor = new Map<string, ChargingPoint[]>();
  for (const p of (points as ChargingPoint[]) ?? []) {
    const list = byFloor.get(p.floor_id) ?? [];
    list.push(p);
    byFloor.set(p.floor_id, list);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Floors</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Pick a floor to see live availability, grouped by station.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {((floors as Floor[]) ?? []).map((floor, i) => {
          const pts = byFloor.get(floor.id) ?? [];
          const availableWorking = pts.filter(
            (p) =>
              p.availability_status === "available" && p.health_status === "working"
          ).length;
          const accent = ACCENTS[i % ACCENTS.length];

          return (
            <Link
              key={floor.id}
              href={`/floors/${floor.id}`}
              className="group animate-pop-in overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
              <div className="p-5">
                <h2 className="font-medium text-neutral-900 transition-colors group-hover:text-violet-700">
                  {floor.name}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {pts.length} charging points
                </p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={`bg-gradient-to-r ${accent} bg-clip-text text-3xl font-bold text-transparent`}
                  >
                    {availableWorking}
                  </span>
                  <span className="text-sm font-medium text-neutral-500">
                    available now
                  </span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
