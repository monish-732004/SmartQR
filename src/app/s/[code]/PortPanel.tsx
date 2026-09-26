"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import { startSession, endSession, reportFault } from "./actions";
import { AvailabilityBadge, HealthBadge } from "@/components/StatusBadges";
import {
  FAULT_ISSUE_LABELS,
  SESSION_PURPOSE_LABELS,
  type ChargingPoint,
  type FaultIssueType,
  type Session,
  type SessionPurpose,
} from "@/lib/types";

interface Props {
  point: ChargingPoint;
  qrCode: string;
  portActiveSession: Session | null;
  myActiveSession: Session | null; // the caller's one global active session, on any port
  myUserId: string;
}

export default function PortPanel({
  point,
  qrCode,
  portActiveSession,
  myActiveSession,
  myUserId,
}: Props) {
  const [purpose, setPurpose] = useState<SessionPurpose>("charging_only");
  const [showReport, setShowReport] = useState(false);
  const [issueType, setIssueType] = useState<FaultIssueType>("no_power");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);

  // point.availability_status is the live-synced signal (it updates via
  // realtime even when portActiveSession — fetched once at page load —
  // hasn't); a mismatch just means "someone else, details unknown yet".
  const occupied = point.availability_status !== "available";
  const mySessionHere =
    myActiveSession?.point_id === point.id
      ? myActiveSession
      : portActiveSession?.user_id === myUserId
        ? portActiveSession
        : null;
  const isMine = !!mySessionHere;
  const hasActiveElsewhere = !!myActiveSession && myActiveSession.point_id !== point.id;

  const accentBorder =
    point.health_status === "maintenance"
      ? "border-l-red-400"
      : occupied
        ? "border-l-neutral-300"
        : "border-l-emerald-400";

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? "Something went wrong.");
    });
  }

  return (
    <div
      className={clsx(
        "rounded-xl border border-neutral-200 border-l-4 bg-white p-4 shadow-sm transition-colors",
        accentBorder
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono font-semibold text-neutral-900">{point.code}</p>
          {point.label && <p className="text-xs text-neutral-500">{point.label}</p>}
        </div>
        <div className="flex gap-1.5">
          <AvailabilityBadge status={point.availability_status} />
          <HealthBadge status={point.health_status} />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {hasActiveElsewhere && (
          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <p>
              You have an active session on another port. End that one before
              starting here.
            </p>
            <button
              disabled={pending}
              onClick={() => run(() => endSession(myActiveSession!.point_id, qrCode))}
              className="mt-3 w-full rounded-md bg-amber-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50"
            >
              {pending ? "Ending…" : "End Session"}
            </button>
          </div>
        )}

        {!hasActiveElsewhere && occupied && !isMine && (
          <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
            {portActiveSession
              ? `In use since ${formatDistanceToNow(
                  new Date(portActiveSession.started_at),
                  { addSuffix: true }
                )}.`
              : "In use."}
          </p>
        )}

        {!hasActiveElsewhere && isMine && mySessionHere && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            <p>
              Started{" "}
              {formatDistanceToNow(new Date(mySessionHere.started_at), {
                addSuffix: true,
              })}{" "}
              &middot; {SESSION_PURPOSE_LABELS[mySessionHere.purpose]}
            </p>
            <button
              disabled={pending}
              onClick={() => run(() => endSession(point.id, qrCode))}
              className="mt-3 w-full rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-transform duration-150 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {pending ? "Ending session…" : "⏹ End Session"}
            </button>
          </div>
        )}

        {!hasActiveElsewhere && !occupied && point.health_status === "maintenance" && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            Under maintenance — can&apos;t be used right now.
          </p>
        )}

        {!hasActiveElsewhere && !occupied && !isMine && point.health_status !== "maintenance" && (
          <div className="flex flex-col gap-2">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as SessionPurpose)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            >
              {Object.entries(SESSION_PURPOSE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              disabled={pending}
              onClick={() => run(() => startSession(point.id, qrCode, purpose))}
              className="rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-transform duration-150 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {pending ? "Marking occupied…" : "🔌 Mark Occupied (Start Charging)"}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="border-t border-neutral-100 pt-3">
          {!showReport ? (
            <button
              onClick={() => setShowReport(true)}
              className="text-xs text-neutral-500 underline transition-colors hover:text-violet-700"
            >
              ⚠️ Report a problem with this port
            </button>
          ) : reportSent ? (
            <p className="text-xs text-emerald-700">Thanks — sent to the library team.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as FaultIssueType)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900"
              >
                {Object.entries(FAULT_ISSUE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details"
                rows={2}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900"
              />
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await reportFault(
                      point.id,
                      qrCode,
                      issueType,
                      description
                    );
                    if (!result.ok) setError(result.message ?? "Something went wrong.");
                    else setReportSent(true);
                  })
                }
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium transition-colors hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Submit report"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
