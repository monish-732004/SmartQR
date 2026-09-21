"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { reviewIncidentReport } from "@/app/admin/actions";
import { IncidentStatusBadge, RestrictionBadge } from "@/components/StatusBadges";
import { CONDUCT_CATEGORY_LABELS } from "@/lib/types";
import type {
  IncidentReport,
  RestrictionScope,
  RestrictionType,
  StudentRestriction,
} from "@/lib/types";

interface Props {
  report: IncidentReport;
  reporterLabel: string;
  studentLabel: string | null;
  pointCode: string | null;
  evidenceUrl: string | null;
  history: { reports: IncidentReport[]; restrictions: StudentRestriction[] } | null;
}

export default function IncidentReportRow({
  report,
  reporterLabel,
  studentLabel,
  pointCode,
  evidenceUrl,
  history,
}: Props) {
  const [investigating, setInvestigating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [restrictionType, setRestrictionType] = useState<RestrictionType>("warning");
  const [restrictionScope, setRestrictionScope] = useState<RestrictionScope>("all_services");
  const [restrictionDays, setRestrictionDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  if (resolved) return null;

  const isConduct = report.report_type === "student_conduct";

  function decide(decision: "approved" | "rejected" | "resolved") {
    setError(null);
    startTransition(async () => {
      const result = await reviewIncidentReport(
        report.id,
        decision,
        notes,
        decision === "approved" ? restrictionType : undefined,
        decision === "approved" ? restrictionScope : undefined,
        decision === "approved" && restrictionType === "temporary" ? restrictionDays : undefined
      );
      if (!result.ok) setError(result.message);
      else setResolved(true);
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">
              {isConduct ? "Student conduct" : "Socket issue"}
            </span>
            <IncidentStatusBadge status={report.status} />
          </div>
          {isConduct && studentLabel && (
            <p className="mt-1 text-sm text-neutral-700">
              {studentLabel}
              {report.conduct_category && (
                <span className="text-neutral-400">
                  {" "}
                  — {CONDUCT_CATEGORY_LABELS[report.conduct_category]}
                </span>
              )}
            </p>
          )}
          {pointCode && <p className="text-xs font-mono text-neutral-500">{pointCode}</p>}
          <p className="mt-1 text-sm text-neutral-500">&ldquo;{report.description}&rdquo;</p>
          {evidenceUrl && (
            <a
              href={evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-blue-600 hover:underline"
            >
              View evidence ↗
            </a>
          )}
          <p className="mt-1 text-xs text-neutral-400">
            Reported by {reporterLabel}{" "}
            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {isConduct && history && (
        <div className="mt-3 border-t border-neutral-100 pt-2">
          <button
            onClick={() => setInvestigating((v) => !v)}
            className="text-xs text-violet-700 hover:underline"
          >
            {investigating ? "Hide" : "Investigate"} history (
            {history.reports.length} report{history.reports.length === 1 ? "" : "s"},{" "}
            {history.restrictions.length} restriction
            {history.restrictions.length === 1 ? "" : "s"})
          </button>
          {investigating && (
            <div className="mt-2 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
              {history.reports.length === 0 && history.restrictions.length === 0 && (
                <p>No prior history for this student — first offense.</p>
              )}
              {history.restrictions.map((r) => (
                <div key={r.id} className="mb-1 flex items-center gap-2">
                  <RestrictionBadge type={r.restriction_type} />
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  {r.revoked_at && <span className="text-neutral-400">(revoked)</span>}
                </div>
              ))}
              {history.reports.map((r) => (
                <div key={r.id} className="mb-1 flex items-center gap-2">
                  <IncidentStatusBadge status={r.status} />
                  <span>{r.report_type === "student_conduct" ? "Conduct" : "Socket"} report</span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Review notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
          />
        </div>

        {isConduct && (
          <>
            {approving && (
              <>
                <div className="flex flex-col">
                  <label className="text-xs text-neutral-500">Restriction</label>
                  <select
                    value={restrictionType}
                    onChange={(e) => setRestrictionType(e.target.value as RestrictionType)}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                  >
                    <option value="warning">Warning only</option>
                    <option value="temporary">Temporary</option>
                    <option value="permanent">Permanent</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-neutral-500">Scope</label>
                  <select
                    value={restrictionScope}
                    onChange={(e) => setRestrictionScope(e.target.value as RestrictionScope)}
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                  >
                    <option value="all_services">All library services</option>
                    <option value="sockets">Sockets only</option>
                  </select>
                </div>
                {restrictionType === "temporary" && (
                  <div className="flex flex-col">
                    <label className="text-xs text-neutral-500">Days</label>
                    <input
                      type="number"
                      min={1}
                      value={restrictionDays}
                      onChange={(e) => setRestrictionDays(Number(e.target.value))}
                      className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </>
            )}
            <button
              disabled={pending}
              onClick={() => (approving ? decide("approved") : setApproving(true))}
              className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {approving ? "Confirm approve & restrict" : "Approve (violation confirmed)"}
            </button>
          </>
        )}

        <button
          disabled={pending}
          onClick={() => decide("rejected")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          disabled={pending}
          onClick={() => decide("resolved")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Resolve
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
