import { createClient } from "@/lib/supabase/server";
import { FAULT_ISSUE_LABELS } from "@/lib/types";
import ReportRow from "./ReportRow";
import TicketRow from "./TicketRow";

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("fault_reports")
    .select("*, charging_points(code), profiles!fault_reports_reporter_id_fkey(email)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: tickets } = await supabase
    .from("maintenance_tickets")
    .select("*, charging_points(code)")
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  // Corroboration count per point, for pending reports only.
  const corroboration = new Map<string, number>();
  for (const r of reports ?? []) {
    corroboration.set(r.point_id, (corroboration.get(r.point_id) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Fault report inbox</h1>

      {(!reports || reports.length === 0) && (
        <p className="text-sm text-neutral-500">No pending reports.</p>
      )}

      <div className="flex flex-col gap-3">
        {(reports ?? []).map((r) => (
          <ReportRow
            key={r.id}
            report={r}
            pointCode={r.charging_points?.code ?? "—"}
            reporterEmail={r.profiles?.email ?? "—"}
            corroborationCount={corroboration.get(r.point_id) ?? 1}
            issueLabel={FAULT_ISSUE_LABELS[r.issue_type as keyof typeof FAULT_ISSUE_LABELS]}
          />
        ))}
      </div>

      <h2 className="mt-10 mb-4 text-xl font-semibold">Open maintenance tickets</h2>
      {(!tickets || tickets.length === 0) && (
        <p className="text-sm text-neutral-500">No open tickets.</p>
      )}
      <div className="flex flex-col gap-3">
        {(tickets ?? []).map((t) => (
          <TicketRow key={t.id} ticket={t} pointCode={t.charging_points?.code ?? "—"} />
        ))}
      </div>
    </div>
  );
}
