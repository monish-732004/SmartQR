import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth";
import type {
  ChargingPoint,
  IncidentReport,
  Profile,
  StudentRestriction,
} from "@/lib/types";
import IncidentReportRow from "./IncidentReportRow";
import RestrictionRow from "./RestrictionRow";

type ReportRow = IncidentReport & {
  reporter: Pick<Profile, "email" | "full_name"> | null;
  student: Pick<Profile, "full_name" | "email" | "registration_id"> | null;
  charging_points: Pick<ChargingPoint, "code"> | null;
};

export default async function IncidentsPage() {
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/admin");

  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("incident_reports")
    .select(
      "*, reporter:profiles!incident_reports_reporter_id_fkey(email, full_name), student:profiles!incident_reports_student_id_fkey(full_name, email, registration_id), charging_points(code)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const rows = (reports as ReportRow[]) ?? [];

  // Per-student history: other reports + restriction history, for the
  // "investigate" panel. Small N (pending queue), fine to do per-row.
  const historyByStudent = new Map<
    string,
    { reports: IncidentReport[]; restrictions: StudentRestriction[] }
  >();
  for (const r of rows) {
    if (!r.student_id || historyByStudent.has(r.student_id)) continue;
    const [{ data: pastReports }, { data: pastRestrictions }] = await Promise.all([
      supabase
        .from("incident_reports")
        .select("*")
        .eq("student_id", r.student_id)
        .neq("id", r.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_restrictions")
        .select("*")
        .eq("student_id", r.student_id)
        .order("created_at", { ascending: false }),
    ]);
    historyByStudent.set(r.student_id, {
      reports: (pastReports as IncidentReport[]) ?? [],
      restrictions: (pastRestrictions as StudentRestriction[]) ?? [],
    });
  }

  // Signed URLs for evidence — bucket is private.
  const evidenceUrls = new Map<string, string>();
  for (const r of rows) {
    if (!r.evidence_path) continue;
    const { data } = await supabase.storage
      .from("incident-evidence")
      .createSignedUrl(r.evidence_path, 60 * 10);
    if (data?.signedUrl) evidenceUrls.set(r.id, data.signedUrl);
  }

  const { data: restrictions } = await supabase
    .from("student_restrictions")
    .select("*, student:profiles!student_restrictions_student_id_fkey(full_name, email, registration_id)")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const activeRestrictions = ((restrictions as (StudentRestriction & {
    student: Pick<Profile, "full_name" | "email" | "registration_id"> | null;
  })[]) ?? []).filter((r) => !r.ends_at || new Date(r.ends_at) > new Date());

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Incident review</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Every librarian report lands here first. Nothing is ever applied to
        a student automatically — approve, reject, or resolve each one
        yourself, after checking their history below.
      </p>

      <h2 className="mb-3 text-sm font-medium text-neutral-700">
        Pending reports ({rows.length})
      </h2>
      {rows.length === 0 && (
        <p className="mb-8 text-sm text-neutral-500">No pending reports.</p>
      )}
      <div className="mb-10 flex flex-col gap-3">
        {rows.map((r) => (
          <IncidentReportRow
            key={r.id}
            report={r}
            reporterLabel={r.reporter?.full_name ?? r.reporter?.email ?? "—"}
            studentLabel={
              r.student
                ? `${r.student.full_name ?? r.student.email} (${r.student.registration_id ?? r.student.email})`
                : null
            }
            pointCode={r.charging_points?.code ?? null}
            evidenceUrl={evidenceUrls.get(r.id) ?? null}
            history={r.student_id ? historyByStudent.get(r.student_id) ?? null : null}
          />
        ))}
      </div>

      <h2 className="mb-3 text-sm font-medium text-neutral-700">
        Active restrictions ({activeRestrictions.length})
      </h2>
      {activeRestrictions.length === 0 && (
        <p className="text-sm text-neutral-500">No active restrictions.</p>
      )}
      <div className="flex flex-col gap-2">
        {activeRestrictions.map((r) => (
          <RestrictionRow
            key={r.id}
            restriction={r}
            studentLabel={r.student?.full_name ?? r.student?.email ?? "—"}
          />
        ))}
      </div>
    </div>
  );
}
