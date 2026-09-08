"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FaultIssueType, SessionPurpose } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; message: string };

function friendlyError(error: { message: string; code?: string }): string {
  if (error.message.includes("uniq_active_session_per_point")) {
    return "Someone else just started a session on this port a moment ago.";
  }
  if (error.message.includes("uniq_active_session_per_user")) {
    return "You already have an active session on another port. End it before starting a new one.";
  }
  return error.message;
}

function revalidateEverywhere(qrCode: string) {
  revalidatePath(`/s/${qrCode}`);
  revalidatePath("/floors", "layout");
  revalidatePath("/admin", "layout");
}

export async function startSession(
  pointId: string,
  qrCode: string,
  purpose: SessionPurpose
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_charging_session", {
    p_point_id: pointId,
    p_purpose: purpose,
  });

  if (error) return { ok: false, message: friendlyError(error) };

  revalidateEverywhere(qrCode);
  return { ok: true };
}

export async function endSession(
  pointId: string,
  qrCode: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_charging_session", {
    p_point_id: pointId,
  });

  if (error) return { ok: false, message: friendlyError(error) };

  revalidateEverywhere(qrCode);
  return { ok: true };
}

export async function reportFault(
  pointId: string,
  qrCode: string,
  issueType: FaultIssueType,
  description: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("file_fault_report", {
    p_point_id: pointId,
    p_issue_type: issueType,
    p_description: description || null,
  });

  if (error) return { ok: false, message: friendlyError(error) };

  revalidateEverywhere(qrCode);
  return { ok: true };
}
