"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideInvite } from "@/lib/actions/invites";
import { InviteStatusBadge, type InviteStatus } from "./invite-status";

export type ApprovalRow = {
  id: string;
  profileName: string;
  isDemo: boolean;
  status: InviteStatus;
  note: string | null;
};

export function ApprovalQueue({ rows }: { rows: ApprovalRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No applications waiting</p>;
  }

  return (
    <ul className="glass rounded-lg divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id}>
          <DecisionRow row={row} />
        </li>
      ))}
    </ul>
  );
}

function DecisionRow({ row }: { row: ApprovalRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await decideInvite(row.id, approve);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-medium">{row.profileName}</span>
          {row.note && <p className="text-muted-foreground">{row.note}</p>}
        </div>
        <div className="flex items-center gap-2">
          <InviteStatusBadge status={row.status} />
          <button
            type="button"
            onClick={() => decide(true)}
            disabled={pending}
            className="rounded-full bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => decide(false)}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1 disabled:opacity-50 bg-secondary hover:bg-foreground/10"
          >
            Reject
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
