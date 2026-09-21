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

export type IncidentReportType = "socket_issue" | "student_conduct";
export type ConductCategory =
  | "playing_games"
  | "excessive_talking"
  | "disturbing_others"
  | "inappropriate_behavior"
  | "other";
export type IncidentReportStatus = "pending" | "approved" | "rejected" | "resolved";
export type RestrictionType = "warning" | "temporary" | "permanent";
export type RestrictionScope = "sockets" | "all_services";

export interface IncidentReport {
  id: string;
  report_type: IncidentReportType;
  reporter_id: string;
  student_id: string | null;
  point_id: string | null;
  conduct_category: ConductCategory | null;
  description: string;
  occurred_at: string;
  evidence_path: string | null;
  status: IncidentReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface StudentRestriction {
  id: string;
  student_id: string;
  incident_report_id: string;
  restriction_type: RestrictionType;
  scope: RestrictionScope;
  reason: string | null;
  starts_at: string;
  ends_at: string | null;
  issued_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
}

export type StudyCategory =
  | "dsa"
  | "system_design"
  | "aptitude"
  | "interview_prep"
  | "reading"
  | "other";

export interface StudyActivity {
  id: string;
  user_id: string;
  category: StudyCategory;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export const STUDY_CATEGORY_LABELS: Record<StudyCategory, string> = {
  dsa: "DSA",
  system_design: "System design",
  aptitude: "Aptitude",
  interview_prep: "Interview prep",
  reading: "Reading",
  other: "Other",
};

export const CONDUCT_CATEGORY_LABELS: Record<ConductCategory, string> = {
  playing_games: "Playing games",
  excessive_talking: "Excessive talking",
  disturbing_others: "Disturbing others",
  inappropriate_behavior: "Inappropriate behavior",
  other: "Other",
};

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
