"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyToPostedEvent } from "./actions";

const input =
  "glass-inset rounded-field px-3 py-2 focus:border-ring focus:outline-none";

export function ApplyForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply() {
    setError(null);
    startTransition(async () => {
      const result = await applyToPostedEvent(eventId, note);
      if ("error" in result) {
        setError(result.error);
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
      <div>
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
        >
          Apply to co-host
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
