"use client";

import { useState, useTransition } from "react";
import { reportSocketIssue, reportStudentConduct } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import { CONDUCT_CATEGORY_LABELS } from "@/lib/types";
import type { ChargingPoint, ConductCategory, Profile, Session } from "@/lib/types";

type SessionRow = Session & {
  profiles: Pick<Profile, "id" | "full_name" | "email" | "registration_id"> | null;
  charging_points: Pick<ChargingPoint, "id" | "code" | "label"> | null;
};

const CONDUCT_CATEGORIES = Object.keys(CONDUCT_CATEGORY_LABELS) as ConductCategory[];

async function uploadEvidence(file: File): Promise<string> {
  const supabase = createClient();
  const path = `${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("incident-evidence").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

export default function StudentSessionRow({
  session,
  isActive,
}: {
  session: SessionRow;
  isActive: boolean;
}) {
  const [open, setOpen] = useState<"socket" | "conduct" | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ConductCategory>("playing_games");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const student = session.profiles;
  const point = session.charging_points;

  function reset() {
    setOpen(null);
    setDescription("");
    setFile(null);
    setError(null);
  }

  function submitSocketIssue() {
    setError(null);
    startTransition(async () => {
      try {
        const evidencePath = file ? await uploadEvidence(file) : null;
        const result = await reportSocketIssue(point!.id, description, evidencePath);
        if (!result.ok) setError(result.message);
        else {
          setDone(true);
          reset();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    });
  }

  function submitConduct() {
    setError(null);
    startTransition(async () => {
      try {
        const evidencePath = file ? await uploadEvidence(file) : null;
        const result = await reportStudentConduct(
          student!.id,
          point?.id ?? null,
          category,
          description,
          new Date(occurredAt).toISOString(),
          evidencePath
        );
        if (!result.ok) setError(result.message);
        else {
          setDone(true);
          reset();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    });
  }

  return (
    <>
      <tr className="border-t border-neutral-100 align-top">
        <td className="px-4 py-2">
          <p className="font-medium text-neutral-900">{student?.full_name ?? "—"}</p>
          <p className="text-xs text-neutral-500">
            {student?.registration_id ?? student?.email ?? "—"}
          </p>
        </td>
        <td className="px-4 py-2 font-mono text-neutral-700">
          {point?.code ?? "—"}
          {point?.label && <span className="ml-1 text-xs text-neutral-400">{point.label}</span>}
        </td>
        <td className="px-4 py-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              isActive
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-neutral-400"}`}
            />
            {isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-2 text-xs text-neutral-500">
          {new Date(session.started_at).toLocaleString()}
          {session.ended_at && (
            <> — {new Date(session.ended_at).toLocaleTimeString()}</>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          {done ? (
            <span className="text-xs text-emerald-700">Reported</span>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(open === "socket" ? null : "socket")}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
              >
                Report socket
              </button>
              <button
                onClick={() => setOpen(open === "conduct" ? null : "conduct")}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
              >
                Report student
              </button>
            </div>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-neutral-100 bg-neutral-50/60">
          <td colSpan={5} className="px-4 py-3">
            {open === "conduct" && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ConductCategory)}
                className="mb-2 rounded-md border border-neutral-300 px-2 py-1 text-xs"
              >
                {CONDUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CONDUCT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
            {open === "conduct" && (
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="mb-2 ml-2 rounded-md border border-neutral-300 px-2 py-1 text-xs"
              />
            )}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                open === "socket"
                  ? "Describe the socket problem…"
                  : "Describe what happened…"
              }
              className="block w-full rounded-md border border-neutral-300 px-2 py-1 text-xs"
              rows={2}
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
              <button
                onClick={open === "socket" ? submitSocketIssue : submitConduct}
                disabled={pending || !description.trim()}
                className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit report"}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
