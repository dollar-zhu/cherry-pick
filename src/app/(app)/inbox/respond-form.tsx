"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToInvite } from "@/lib/actions/invites";

const input =
  "glass-inset rounded-field px-3 py-2 focus:border-ring focus:outline-none";

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
      <label className="flex flex-col gap-1 text-sm">
        Note for the host
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Optional"
          className={input}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={pending}
          className="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={pending}
          className="rounded-full border border-border px-3 py-1 text-sm disabled:opacity-50 bg-secondary hover:bg-foreground/10"
        >
          Decline
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
