export const INVITE_STATUSES = ["pending", "accepted", "applied", "declined", "approved", "rejected"] as const;

export type InviteStatus = (typeof INVITE_STATUSES)[number];

const LABELS: Record<InviteStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  applied: "Applied",
  declined: "Declined",
  approved: "Approved",
  rejected: "Rejected",
};

const STYLES: Record<InviteStatus, string> = {
  pending: "bg-muted text-foreground",
  accepted: "bg-warning/15 text-warning",
  applied: "bg-warning/15 text-warning",
  declined: "bg-muted text-muted-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

export function isInviteStatus(value: string): value is InviteStatus {
  return (INVITE_STATUSES as readonly string[]).includes(value);
}

export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
