"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvites } from "@/lib/actions/invites";
import { InviteStatusBadge, type InviteStatus } from "./invite-status";

export type MatchRow = {
  id: string;
  profileId: string;
  profileName: string;
  profileCity: string;
  isDemo: boolean;
  score: number | null; // null = passed the filters, not ranked
  reasons: string[];
  openQuestions: string[];
};

type Props = {
  rows: MatchRow[];
  eventId?: string;
  /** Invite status per profile id, for companies already invited. */
  inviteStatus?: Record<string, InviteStatus>;
};

const INVITE_CAP = 25;

export function DemoBadge() {
  return (
    <span
      title="Fictional demo company. No one will reply to an invite."
      className="rounded-full border border-border px-1.5 text-xs font-normal text-muted-foreground"
    >
      Demo
    </span>
  );
}

export function MatchesTable({ rows, eventId, inviteStatus = {} }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Rows arrive best match first, so "select all" past the cap keeps the top ones.
  const selectable = rows.filter((row) => !inviteStatus[row.profileId]);
  const target = selectable.slice(0, INVITE_CAP);
  const selectedRows = rows.filter((row) => selected.has(row.profileId));
  const demoCount = selectedRows.filter((row) => row.isDemo).length;
  const allSelected = target.length > 0 && target.every((row) => selected.has(row.profileId));
  const someSelected = selected.size > 0 && !allSelected;
  const canInvite = Boolean(eventId);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggle(profileId: string) {
    if (!selected.has(profileId) && selected.size >= INVITE_CAP) {
      setError(`You can send at most ${INVITE_CAP} invites at a time.`);
      return;
    }
    setError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function toggleAll() {
    setError(null);
    setSelected(allSelected ? new Set() : new Set(target.map((row) => row.profileId)));
  }

  function confirmSend() {
    if (!eventId || selectedRows.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await sendInvites(
        eventId,
        selectedRows.map((row) => row.profileId),
      );
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      dialogRef.current?.close();
      setSelected(new Set());
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matching organizations yet.{" "}
        <Link href="/events/new" className="underline underline-offset-2">
          Refine your intent
        </Link>{" "}
        or click <strong>Find matches</strong> to search the directory.
      </p>
    );
  }

  const invites = (n: number) => `${n} ${n === 1 ? "invite" : "invites"}`;

  return (
    <div className="flex flex-col gap-3">
      {canInvite && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              disabled={selectable.length === 0}
              onChange={toggleAll}
              className="size-4 accent-primary"
            />
            {selectable.length === 0
              ? "Everyone here is invited"
              : selectable.length > INVITE_CAP
                ? `Select top ${INVITE_CAP}`
                : `Select all ${selectable.length}`}
          </label>
          {selected.size > 0 && (
            <span className="text-muted-foreground">
              {selected.size} of {selectable.length} selected ·{" "}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear
              </button>
            </span>
          )}
        </div>
      )}

      <div className="glass rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {canInvite && <th className="w-10 px-4 py-3"><span className="sr-only">Select</span></th>}
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Fit</th>
              <th className="px-4 py-3 font-medium">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = inviteStatus[row.profileId];
              const isSelected = selected.has(row.profileId);
              const clickable = canInvite && !status;
              return (
                <tr
                  key={row.id}
                  onClick={clickable ? () => toggle(row.profileId) : undefined}
                  className={`border-b border-border align-top last:border-0 ${
                    clickable ? "cursor-pointer hover:bg-muted" : ""
                  } ${isSelected ? "bg-foreground/[0.06]" : ""} ${status ? "text-muted-foreground" : ""}`}
                >
                  {canInvite && (
                    <td className="px-4 py-3">
                      {!status && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(row.profileId)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${row.profileName}`}
                          className="size-4 accent-primary"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      {row.profileName}
                      {row.isDemo && <DemoBadge />}
                    </div>
                    <div className="text-xs text-muted-foreground">{row.profileCity}</div>
                    {status && (
                      <div className="mt-1">
                        <InviteStatusBadge status={status} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.score != null ? (
                      <span className="font-mono">{row.score.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.reasons.length > 0 ? (
                      <ul className="list-inside list-disc space-y-0.5">
                        {row.reasons.map((reason, index) => (
                          <li key={`${index}-${reason}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">Not ranked</span>
                    )}
                    {row.openQuestions.length > 0 && (
                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-warning">
                        {row.openQuestions.map((question, index) => (
                          <li key={`q-${index}-${question}`}>{question}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canInvite && selected.size > 0 && (
        // Floating bar so Send stays in reach while scrolling a long list.
        <div className="sticky bottom-4 z-10 mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-full glass-raised py-2 pr-2 pl-5 text-sm shadow-lg backdrop-blur">
          <span>{selected.size} selected</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              dialogRef.current?.showModal();
            }}
            className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
          >
            Send {invites(selected.size)}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {canInvite && (
        <dialog
          ref={dialogRef}
          aria-labelledby="send-invites-title"
          className="m-auto rounded-lg w-[calc(100%-2rem)] max-w-md glass-raised p-6 text-foreground backdrop:bg-background/70"
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              confirmSend();
            }}
          >
            <h3 id="send-invites-title" className="text-lg font-semibold">
              Send {invites(selectedRows.length)}?
            </h3>
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {selectedRows.map((row) => (
                <li key={row.profileId} className="flex items-center gap-1.5">
                  {row.profileName}
                  {row.isDemo && <DemoBadge />}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Each company sees the invite in its inbox and can accept or decline.
              {demoCount > 0 &&
                ` ${demoCount} ${demoCount === 1 ? "is a demo company" : "are demo companies"}: no one will reply.`}
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-full border border-border px-4 py-1.5 text-sm bg-secondary hover:bg-foreground/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || selectedRows.length === 0}
                className="rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
              >
                {pending ? "Sending…" : `Send ${invites(selectedRows.length)}`}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
