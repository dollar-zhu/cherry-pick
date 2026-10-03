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
      <h2 className="text-lg font-semibold">Applications</h2>
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
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
          <span className="text-zinc-500">{row.eventTitle}</span>
          {row.note && <p className="text-zinc-600 dark:text-zinc-400">{row.note}</p>}
        </div>
        <div className="flex items-center gap-2">
          {status && <InviteStatusBadge status={status} />}
          <button
            type="button"
            onClick={() => decide(true)}
            disabled={pending}
            className="rounded-full bg-zinc-900 px-3 py-1 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => decide(false)}
            disabled={pending}
            className="rounded-full border border-zinc-300 px-3 py-1 disabled:opacity-50 dark:border-zinc-700"
          >
            Reject
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
