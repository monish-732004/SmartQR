"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordForm({
  email,
  landingHref,
}: {
  email: string;
  landingHref: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStatus("error");
      setError(updateError.message);
      return;
    }

    const { error: markError } = await supabase.rpc("mark_password_set");
    if (markError) {
      setStatus("error");
      setError(markError.message);
      return;
    }

    setStatus("done");
    router.refresh();
  }

  if (status === "done") {
    return (
      <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="mb-2">
          Password set. From now on you can sign in with{" "}
          <strong>{email}</strong> and this password — no email link needed.
        </p>
        <button
          onClick={() => router.push(landingHref)}
          className="text-sm font-medium underline"
        >
          Continue →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">
          Email
        </label>
        <input
          value={email}
          disabled
          className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">
          New password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-500">
          Confirm password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>
      <button
        type="submit"
        disabled={status === "saving"}
        className="mt-1 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "saving" ? "Saving…" : "Set password"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
