import type { AvailabilityStatus, HealthStatus } from "@/lib/types";
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
