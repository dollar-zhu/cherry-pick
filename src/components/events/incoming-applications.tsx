"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideInvite } from "@/lib/actions/invites";
import { InviteStatusBadge, isInviteStatus } from "./invite-status";

export type IncomingApplication = {
  id: string;
  status: string;
  note: string | null;
  eventId: string;
  eventTitle: string;
  companyName: string;
};

export function IncomingApplications({ rows }: { rows: IncomingApplication[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-2xl tracking-[-0.01em]">Applications</h2>
      <ul className="divide-y divide-rule rounded-2xl border border-rule bg-card">
        {rows.map((row) => (
          <li key={row.id}>
            <DecisionRow row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DecisionRow({ row }: { row: IncomingApplication }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status = isInviteStatus(row.status) ? row.status : null;

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
          <span className="font-medium">{row.companyName}</span>
          <span className="text-ink-2">{row.eventTitle}</span>
          {row.note && <p className="text-ink-2">{row.note}</p>}
        </div>
        <div className="flex items-center gap-2">
          {status && <InviteStatusBadge status={status} />}
          <button
            type="button"
            onClick={() => decide(true)}
            disabled={pending}
            className="rounded-full bg-ink px-3 py-1 text-paper font-medium transition-[transform,opacity] duration-[var(--dur-micro)] active:scale-[0.98] disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => decide(false)}
            disabled={pending}
            className="rounded-full border border-rule px-3 py-1 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-brand">
          {error}
        </p>
      )}
    </div>
  );
}
