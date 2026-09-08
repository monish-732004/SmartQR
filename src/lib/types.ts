export type UserRole = "student" | "librarian" | "admin";

export type AvailabilityStatus = "available" | "occupied" | "reserved";
export type HealthStatus = "working" | "reported_issue" | "maintenance";

export type SessionPurpose =
  | "charging_only"
  | "study"
  | "project_work"
  | "exam_prep";

export type FaultIssueType =
  | "no_power"
  | "loose_socket"
  | "intermittent_charging"
  | "physical_damage"
  | "overheating"
  | "other";

export type FaultReportStatus = "pending" | "verified" | "dismissed";
export type TicketStatus = "open" | "closed";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  has_password: boolean;
  floor_id: string | null;
  registration_id: string | null;
  created_at: string;
}

export interface Floor {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface ChargingPoint {
  id: string;
  code: string;
  qr_code: string;
  floor_id: string;
  label: string | null;
  availability_status: AvailabilityStatus;
  health_status: HealthStatus;
  created_at: string;
}

export interface Session {
  id: string;
  point_id: string;
  user_id: string;
  purpose: SessionPurpose;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  last_confirmed_at: string | null;
  created_at: string;
}

export interface FaultReport {
  id: string;
  point_id: string;
  reporter_id: string;
  issue_type: FaultIssueType;
  description: string | null;
  status: FaultReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  point_id: string | null;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface MaintenanceTicket {
  id: string;
  point_id: string;
  fault_report_id: string | null;
  opened_by: string;
  owner: string | null;
  deadline: string | null;
  status: TicketStatus;
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
  resolution_notes: string | null;
}

export const FAULT_ISSUE_LABELS: Record<FaultIssueType, string> = {
  no_power: "No power",
  loose_socket: "Loose socket",
  intermittent_charging: "Intermittent charging",
  physical_damage: "Physical damage",
  overheating: "Overheating",
  other: "Other",
};

export const SESSION_PURPOSE_LABELS: Record<SessionPurpose, string> = {
  charging_only: "Charging only",
  study: "Study",
  project_work: "Project work",
  exam_prep: "Exam prep",
};
