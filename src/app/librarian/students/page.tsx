import { createClient } from "@/lib/supabase/server";
import type { ChargingPoint, Profile, Session } from "@/lib/types";
import StudentSessionRow from "./StudentSessionRow";
import LiveRefresh from "@/components/LiveRefresh";
import OnlineStudents from "./OnlineStudents";

function last24HoursCutoff(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

type SessionRow = Session & {
  profiles: Pick<Profile, "id" | "full_name" | "email" | "registration_id"> | null;
  charging_points: Pick<ChargingPoint, "id" | "code" | "label"> | null;
};

export default async function StudentsPage() {
  const supabase = await createClient();

  // RLS already floor-scopes this for librarians (sessions_select_own in
  // 0008 checks can_access_floor via the point), same as admin/reports
  // relies on RLS rather than a manual floor filter.
  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "*, profiles(id, full_name, email, registration_id), charging_points(id, code, label)"
    )
    .gte("started_at", last24HoursCutoff())
    .order("started_at", { ascending: false });

  const rows = (sessions as SessionRow[]) ?? [];
  const active = rows.filter((r) => !r.ended_at);
  const inactive = rows.filter((r) => r.ended_at);

  return (
    <div>
      <LiveRefresh table="sessions" />
      <h1 className="mb-2 text-xl font-semibold">Students</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Students online right now, and everyone who has used a socket in the last 24 hours. Report a socket
        issue or a student directly from their row — every report goes to
        the super admin for review, nothing here bans anyone automatically.
      </p>

      <OnlineStudents chargingUserIds={active.map((s) => s.user_id)} />

      <h2 className="mb-3 text-sm font-medium text-neutral-700">
        Active ({active.length})
      </h2>
      <div className="mb-8 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {active.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No one is currently using a socket.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {active.map((s) => (
                <StudentSessionRow key={s.id} session={s} isActive />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mb-3 text-sm font-medium text-neutral-700">
        Inactive — last 24h ({inactive.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {inactive.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No ended sessions in the last 24 hours.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {inactive.map((s) => (
                <StudentSessionRow key={s.id} session={s} isActive={false} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
