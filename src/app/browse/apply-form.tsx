"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonDark, buttonQuiet, input } from "@/components/styles";
import { applyToPostedEvent } from "./actions";

export function ApplyForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonQuiet} self-start`}>
        Apply to co-host
      </button>
    );
  }

  return (
    <div className="reveal flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm text-ink-2">
        Note for the host
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={2}
          autoFocus
          placeholder="Optional. Say what your company brings."
          className={`${input} resize-none text-sm`}
        />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={apply} disabled={pending} className={`${buttonDark} flex-1`}>
          {pending ? "Sending…" : "Send application"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className={buttonQuiet}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      )}
    </div>
  );
}
