"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvites } from "@/lib/actions/invites";

export type MatchRow = {
  id: string;
  profileId: string;
  profileName: string;
  profileCity: string;
  score: number;
  reasons: string[];
};

type Props = {
  rows: MatchRow[];
  eventId?: string;
  invitedProfileIds?: string[];
};

const INVITE_CAP = 25;

export function MatchesTable({ rows, eventId, invitedProfileIds = [] }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const invited = new Set(invitedProfileIds);
  const selectable = rows.filter((row) => !invited.has(row.profileId));
  const selectedRows = rows.filter((row) => selected.has(row.profileId));
  const allSelected =
    selectable.length > 0 &&
    selectable.length <= INVITE_CAP &&
    selectable.every((row) => selected.has(row.profileId));

  function toggle(profileId: string) {
    if (!selected.has(profileId) && selected.size >= INVITE_CAP) {
      setError("You can send at most 25 invites at a time.");
      return;
    }
    setError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(profileId)) next.delete(profileId);
      else if (next.size < INVITE_CAP) next.add(profileId);
      return next;
    });
  }

  function toggleAll() {
    setError(null);
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    const next = selectable.slice(0, INVITE_CAP).map((row) => row.profileId);
    if (selectable.length > INVITE_CAP) {
      setError("You can send at most 25 invites at a time.");
    }
    setSelected(new Set(next));
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
      <p className="text-sm text-zinc-500">
        No matching organizations yet.{" "}
        <Link href="/events/new" className="underline underline-offset-2">
          Refine your intent
        </Link>{" "}
        or click <strong>Find matches</strong> to search the directory.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {eventId && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={selectedRows.length === 0 || pending}
            onClick={() => {
              setError(null);
              dialogRef.current?.showModal();
            }}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
          >
            {selectedRows.length === 0
              ? "Send invites"
              : `Send ${selectedRows.length} ${selectedRows.length === 1 ? "invite" : "invites"}`}
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              {eventId && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectable.length === 0}
                    onChange={toggleAll}
                    aria-label="Select companies to invite"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Fit</th>
              <th className="px-4 py-3 font-medium">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const alreadyInvited = invited.has(row.profileId);
              return (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  {eventId && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.profileId)}
                        disabled={alreadyInvited}
                        onChange={() => toggle(row.profileId)}
                        aria-label={
                          alreadyInvited
                            ? `${row.profileName} already invited`
                            : `Select ${row.profileName}`
                        }
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">
                    {row.profileName}
                    {alreadyInvited && (
                      <span className="ml-2 text-xs font-normal text-zinc-400">Invited</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{row.profileCity}</td>
                  <td className="px-4 py-3">
                    {row.score > 0 ? (
                      <span className="font-mono">{row.score.toFixed(1)}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.reasons.length > 0 ? (
                      <ul className="list-inside list-disc space-y-0.5">
                        {row.reasons.map((reason, index) => (
                          <li key={`${index}-${reason}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {eventId && (
        <dialog
          ref={dialogRef}
          aria-labelledby="send-invites-title"
          className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              confirmSend();
            }}
          >
            <h3 id="send-invites-title" className="text-lg font-semibold">
              Send {selectedRows.length} {selectedRows.length === 1 ? "invite" : "invites"}?
            </h3>
            <ul className="max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
              {selectedRows.map((row) => (
                <li key={row.profileId}>{row.profileName}</li>
              ))}
            </ul>
            <p className="text-sm text-zinc-500">
              Each company will see this invite in their inbox and can accept or decline.
            </p>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || selectedRows.length === 0}
                className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
              >
                {pending ? "Sending…" : "Send invites"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
