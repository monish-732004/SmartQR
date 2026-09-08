"use client";

import { useState, useTransition } from "react";
import { setUserRole } from "@/app/admin/actions";
import type { Floor, Profile, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["student", "librarian", "admin"];

export default function UserRoleRow({
  user,
  isSelf,
  floors,
}: {
  user: Profile;
  isSelf: boolean;
  floors: Floor[];
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [floorId, setFloorId] = useState<string | null>(user.floor_id);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = role !== user.role || (role === "librarian" && floorId !== user.floor_id);
  const needsFloor = role === "librarian" && !floorId;

  return (
    <tr className="border-t border-neutral-100 align-top">
      <td className="px-4 py-2">{user.email}</td>
      <td className="px-4 py-2 text-neutral-600">{user.full_name ?? "—"}</td>
      <td className="px-4 py-2 font-mono text-xs text-neutral-500">
        {user.registration_id ?? "—"}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            value={role}
            disabled={isSelf}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {isSelf && <span className="text-xs text-neutral-400">(you)</span>}
        </div>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          {role === "librarian" ? (
            <select
              value={floorId ?? ""}
              onChange={(e) => setFloorId(e.target.value || null)}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
            >
              <option value="">Choose a floor…</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
          {dirty && !isSelf && !needsFloor && (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await setUserRole(user.id, role, floorId);
                  if (!result.ok) setError(result.message);
                })
              }
              className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
        {needsFloor && (
          <p className="mt-1 text-xs text-amber-600">Pick a floor to save.</p>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
