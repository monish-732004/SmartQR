"use client";

import { useEffect, useState, useTransition } from "react";
import { startStudyActivity, stopStudyActivity } from "./actions";
import { STUDY_CATEGORY_LABELS } from "@/lib/types";
import type { StudyActivity, StudyCategory } from "@/lib/types";

const CATEGORIES = Object.keys(STUDY_CATEGORY_LABELS) as StudyCategory[];

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function StudyTimer({ activeActivity }: { activeActivity: StudyActivity | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeActivity) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeActivity]);

  function start(category: StudyCategory) {
    setError(null);
    startTransition(async () => {
      const result = await startStudyActivity(category, "");
      if (!result.ok) setError(result.message);
    });
  }

  function stop() {
    setError(null);
    startTransition(async () => {
      const result = await stopStudyActivity();
      if (!result.ok) setError(result.message);
    });
  }

  if (activeActivity) {
    const elapsed = now - new Date(activeActivity.started_at).getTime();
    return (
      <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-violet-700">
            Tracking {STUDY_CATEGORY_LABELS[activeActivity.category]}
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-violet-900">
            {formatElapsed(elapsed)}
          </p>
        </div>
        <button
          onClick={stop}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Stopping…" : "Stop"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-neutral-500">Start tracking</p>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => start(c)}
            disabled={pending}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-violet-400 hover:text-violet-700 disabled:opacity-50"
          >
            ▶ {STUDY_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
