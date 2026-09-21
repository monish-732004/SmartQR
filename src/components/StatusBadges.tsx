import type {
  AvailabilityStatus,
  HealthStatus,
  IncidentReportStatus,
  RestrictionType,
} from "@/lib/types";
import clsx from "clsx";

const AVAILABILITY_STYLES: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  occupied: "bg-neutral-200 text-neutral-700",
  reserved: "bg-blue-100 text-blue-800",
};

const AVAILABILITY_DOT: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-500",
  occupied: "bg-neutral-500",
  reserved: "bg-blue-500",
};

const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
};

const HEALTH_STYLES: Record<HealthStatus, string> = {
  working: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  reported_issue: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  maintenance: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
};

const HEALTH_DOT: Record<HealthStatus, string> = {
  working: "bg-emerald-500",
  reported_issue: "bg-amber-500",
  maintenance: "bg-red-500",
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  working: "Working",
  reported_issue: "Reported issue",
  maintenance: "Maintenance",
};

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        AVAILABILITY_STYLES[status]
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          AVAILABILITY_DOT[status],
          status === "available" && "animate-soft-pulse"
        )}
      />
      {AVAILABILITY_LABELS[status]}
    </span>
  );
}

export function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        HEALTH_STYLES[status]
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", HEALTH_DOT[status])} />
      {HEALTH_LABELS[status]}
    </span>
  );
}

const INCIDENT_STATUS_STYLES: Record<IncidentReportStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  approved: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  rejected: "bg-neutral-100 text-neutral-600",
  resolved: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
};

const INCIDENT_STATUS_DOT: Record<IncidentReportStatus, string> = {
  pending: "bg-amber-500",
  approved: "bg-red-500",
  rejected: "bg-neutral-400",
  resolved: "bg-emerald-500",
};

const INCIDENT_STATUS_LABELS: Record<IncidentReportStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  resolved: "Resolved",
};

export function IncidentStatusBadge({ status }: { status: IncidentReportStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        INCIDENT_STATUS_STYLES[status]
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", INCIDENT_STATUS_DOT[status])} />
      {INCIDENT_STATUS_LABELS[status]}
    </span>
  );
}

const RESTRICTION_STYLES: Record<RestrictionType, string> = {
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  temporary: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  permanent: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
};

const RESTRICTION_DOT: Record<RestrictionType, string> = {
  warning: "bg-amber-500",
  temporary: "bg-orange-500",
  permanent: "bg-red-500",
};

const RESTRICTION_LABELS: Record<RestrictionType, string> = {
  warning: "Warning",
  temporary: "Temporary restriction",
  permanent: "Permanent ban",
};

export function RestrictionBadge({ type }: { type: RestrictionType }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        RESTRICTION_STYLES[type]
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", RESTRICTION_DOT[type])} />
      {RESTRICTION_LABELS[type]}
    </span>
  );
}
