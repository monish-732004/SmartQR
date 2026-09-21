"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { verifyFaultReport, dismissFaultReport } from "@/app/admin/actions";
import type { FaultReport } from "@/lib/types";

interface Props {
  report: FaultReport;
  pointCode: string;
  reporterEmail: string;
  corroborationCount: number;
  issueLabel: string;
}

export default function ReportRow({
  report,
  pointCode,
  reporterEmail,
  corroborationCount,
  issueLabel,
}: Props) {
  const [owner, setOwner] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"verified" | "dismissed" | null>(null);

  if (resolved) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono font-medium">{pointCode}</p>
          <p className="text-sm text-neutral-700">{issueLabel}</p>
          {report.description && (
            <p className="mt-1 text-sm text-neutral-500">
              &ldquo;{report.description}&rdquo;
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-400">
            Reported by {reporterEmail}{" "}
            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
          </p>
        </div>
        {corroborationCount >= 2 ? (
          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {corroborationCount} students reported
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            1 report — awaiting corroboration
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Ticket owner</label>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="e.g. facilities@..."
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-neutral-500">Deadline (days)</label>
          <input
            type="number"
            min={1}
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(Number(e.target.value))}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-xs"
          />
        </div>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await verifyFaultReport(report.id, owner, deadlineDays);
              if (!result.ok) setError(result.message);
              else setResolved("verified");
            })
          }
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Verify &amp; open ticket
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await dismissFaultReport(report.id);
              if (!result.ok) setError(result.message);
              else setResolved("dismissed");
            })
          }
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
