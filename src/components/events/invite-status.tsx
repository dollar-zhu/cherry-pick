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
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  accepted: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  applied: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  declined: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
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
