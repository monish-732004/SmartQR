"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { closeMaintenanceTicket } from "@/app/admin/actions";
import type { MaintenanceTicket } from "@/lib/types";

export default function TicketRow({
  ticket,
  pointCode,
}: {
  ticket: MaintenanceTicket;
  pointCode: string;
}) {
  const [notes, setNotes] = useState("");
  const [markWorking, setMarkWorking] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono font-medium">{pointCode}</p>
          {ticket.owner && <p className="text-sm text-neutral-700">Owner: {ticket.owner}</p>}
          <p className="text-xs text-neutral-400">
            Opened {format(new Date(ticket.opened_at), "MMM d, yyyy")}
            {ticket.deadline &&
              ` · Deadline ${format(new Date(ticket.deadline), "MMM d, yyyy")}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Resolution notes"
          className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs"
        />
        <label className="flex items-center gap-1 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={markWorking}
            onChange={(e) => setMarkWorking(e.target.checked)}
          />
          Mark point as Working
        </label>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await closeMaintenanceTicket(ticket.id, notes, markWorking);
              if (!result.ok) setError(result.message);
              else setClosed(true);
            })
          }
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Close ticket
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
