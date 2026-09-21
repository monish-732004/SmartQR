"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  AvailabilityStatus,
  ConductCategory,
  HealthStatus,
  IncidentReportStatus,
  RestrictionScope,
  RestrictionType,
  UserRole,
} from "@/lib/types";

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

  revalidatePath("/librarian", "layout");
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

  revalidatePath("/librarian", "layout");
  return { ok: true };
}

export async function dismissFaultReport(reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_fault_report", {
    p_report_id: reportId,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/librarian", "layout");
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

export async function reportSocketIssue(
  pointId: string,
  description: string,
  evidencePath: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_socket_issue", {
    p_point_id: pointId,
    p_description: description,
    p_evidence_path: evidencePath,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/librarian/students");
  return { ok: true };
}

export async function reportStudentConduct(
  studentId: string,
  pointId: string | null,
  category: ConductCategory,
  description: string,
  occurredAt: string,
  evidencePath: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_student_conduct", {
    p_student_id: studentId,
    p_point_id: pointId,
    p_conduct_category: category,
    p_description: description,
    p_occurred_at: occurredAt,
    p_evidence_path: evidencePath,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/librarian/students");
  return { ok: true };
}

export async function reviewIncidentReport(
  reportId: string,
  decision: IncidentReportStatus,
  reviewNotes: string,
  restrictionType?: RestrictionType,
  restrictionScope?: RestrictionScope,
  restrictionDays?: number
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_incident_report", {
    p_report_id: reportId,
    p_decision: decision,
    p_review_notes: reviewNotes || null,
    p_restriction_type: restrictionType ?? null,
    p_restriction_scope: restrictionScope ?? "all_services",
    p_restriction_days: restrictionDays ?? null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/incidents");
  return { ok: true };
}

export async function revokeRestriction(
  restrictionId: string,
  notes: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_restriction", {
    p_restriction_id: restrictionId,
    p_notes: notes || null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/incidents");
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

  revalidatePath("/librarian", "layout");
  return { ok: true };
}
