import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type { AuditLog } from "@/lib/types";

type Row = AuditLog & {
  profiles: { email: string } | null;
  charging_points: { code: string } | null;
};

const ACTION_LABELS: Record<string, string> = {
  start_session: "Started a session",
  end_session: "Ended a session",
  file_fault_report: "Reported a fault",
  correct_point_status: "Corrected point status",
  verify_fault_report: "Verified a report — opened ticket",
  dismiss_fault_report: "Dismissed a report",
  close_maintenance_ticket: "Closed a maintenance ticket",
  set_user_role: "Changed a user's role",
};

function describe(row: Row): string {
  const d = row.details ?? {};
  switch (row.action) {
    case "end_session":
      return d.duration_minutes ? `${d.duration_minutes} min` : "";
    case "file_fault_report":
      return String(d.issue_type ?? "");
    case "correct_point_status":
      return `${d.availability_before ?? "?"} → ${d.availability_after ?? "?"}, ${d.health_before ?? "?"} → ${d.health_after ?? "?"}`;
    case "close_maintenance_ticket":
      return d.mark_working ? "marked Working" : "";
    case "set_user_role":
      return `${d.from ?? "?"} → ${d.to ?? "?"}`;
    default:
      return "";
  }
}

function ActivityTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No activity yet.</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-500">
          <tr>
            <th className="px-4 py-2 font-medium">When</th>
            <th className="px-4 py-2 font-medium">Who</th>
            <th className="px-4 py-2 font-medium">Action</th>
            <th className="px-4 py-2 font-medium">Point</th>
            <th className="px-4 py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-neutral-100">
              <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                {format(new Date(row.created_at), "MMM d, HH:mm")}
              </td>
              <td className="px-4 py-2">{row.profiles?.email ?? "—"}</td>
              <td className="px-4 py-2">{ACTION_LABELS[row.action] ?? row.action}</td>
              <td className="px-4 py-2 font-mono">{row.charging_points?.code ?? "—"}</td>
              <td className="px-4 py-2 text-neutral-500">{describe(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ActivityPage() {
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*, profiles!audit_log_actor_id_fkey(email), charging_points(code)")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data as Row[]) ?? [];
  const studentRows = rows.filter((r) => r.actor_role === "student");
  const staffRows = rows.filter((r) => r.actor_role === "librarian" || r.actor_role === "admin");

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Activity</h1>
      <p className="mb-6 text-sm text-neutral-500">
        What students and staff have actually been doing — visible to admins only.
      </p>

      <h2 className="mb-3 text-sm font-medium text-neutral-700">Student activity</h2>
      <ActivityTable rows={studentRows} />

      <h2 className="mt-8 mb-3 text-sm font-medium text-neutral-700">
        Librarian &amp; admin activity
      </h2>
      <ActivityTable rows={staffRows} />
    </div>
  );
}
