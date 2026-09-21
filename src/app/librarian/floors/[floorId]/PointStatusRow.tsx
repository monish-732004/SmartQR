"use client";

import { useState, useTransition } from "react";
import { correctPointStatus } from "@/app/admin/actions";
import type { AvailabilityStatus, ChargingPoint, HealthStatus } from "@/lib/types";

const AVAILABILITY_OPTIONS: AvailabilityStatus[] = ["available", "occupied", "reserved"];
const HEALTH_OPTIONS: HealthStatus[] = ["working", "reported_issue", "maintenance"];

export default function PointStatusRow({ point }: { point: ChargingPoint }) {
  const [availability, setAvailability] = useState(point.availability_status);
  const [health, setHealth] = useState(point.health_status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = availability !== point.availability_status || health !== point.health_status;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await correctPointStatus(point.id, availability, health);
      if (!result.ok) setError(result.message);
      else setSaved(true);
    });
  }

  return (
    <tr className="border-t border-neutral-100 align-top">
      <td className="px-4 py-2 font-mono">{point.code}</td>
      <td className="px-4 py-2 text-neutral-600">{point.label ?? "—"}</td>
      <td className="px-4 py-2">
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
        >
          {AVAILABILITY_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            value={health}
            onChange={(e) => setHealth(e.target.value as HealthStatus)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
          >
            {HEALTH_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {dirty && (
            <button
              onClick={save}
              disabled={pending}
              className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          )}
          {saved && !dirty && (
            <span className="text-xs text-emerald-700">Saved</span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
