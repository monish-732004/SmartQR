"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityStatus, HealthStatus, UserRole } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function correctPointStatus(
  pointId: string,
  availability: AvailabilityStatus | null,
  health: HealthStatus | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_point_status", {
    p_point_id: pointId,
    p_availability: availability,
    p_health: health,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function verifyFaultReport(
  reportId: string,
  owner: string,
  deadlineDays: number
): Promise<ActionResult> {
  const supabase = await createClient();
  const deadline = new Date(Date.now() + deadlineDays * 86400_000).toISOString();

  const { error } = await supabase.rpc("verify_fault_report", {
    p_report_id: reportId,
    p_owner: owner || null,
    p_deadline: deadline,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function dismissFaultReport(reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_fault_report", {
    p_report_id: reportId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function setUserRole(
  userId: string,
  role: UserRole,
  floorId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: userId,
    p_role: role,
    p_floor_id: floorId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function closeMaintenanceTicket(
  ticketId: string,
  resolutionNotes: string,
  markWorking: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_maintenance_ticket", {
    p_ticket_id: ticketId,
    p_resolution_notes: resolutionNotes || null,
    p_mark_working: markWorking,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin", "layout");
  return { ok: true };
}
