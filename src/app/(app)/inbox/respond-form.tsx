"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonDark, buttonQuiet, input } from "@/components/ui";
import { respondToInvite } from "@/lib/actions/invites";

export function RespondForm({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondToInvite(inviteId, accept, note);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm text-ink-2">
        Note for the host
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Optional"
          className={`${input} resize-none text-sm`}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={pending}
          className={`${buttonDark} flex-1`}
        >
          {pending ? "Sending…" : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={pending}
          className={`${buttonQuiet} flex-1`}
        >
          Decline
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
