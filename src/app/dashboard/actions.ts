"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StudyCategory } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function startStudyActivity(
  category: StudyCategory,
  label: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_study_activity", {
    p_category: category,
    p_label: label || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function stopStudyActivity(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("stop_study_activity");

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
