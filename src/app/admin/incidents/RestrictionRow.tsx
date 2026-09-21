"use client";

import { useState, useTransition } from "react";
import { revokeRestriction } from "@/app/admin/actions";
import { RestrictionBadge } from "@/components/StatusBadges";
import type { StudentRestriction } from "@/lib/types";

export default function RestrictionRow({
  restriction,
  studentLabel,
}: {
  restriction: StudentRestriction;
  studentLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  if (revoked) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900">{studentLabel}</span>
          <RestrictionBadge type={restriction.restriction_type} />
        </div>
        <p className="text-xs text-neutral-500">
          {restriction.scope === "all_services" ? "All library services" : "Sockets only"}
          {restriction.ends_at &&
            ` — until ${new Date(restriction.ends_at).toLocaleDateString()}`}
          {restriction.reason && ` — ${restriction.reason}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await revokeRestriction(restriction.id, "");
              if (!result.ok) setError(result.message);
              else setRevoked(true);
            })
          }
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Revoke
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
