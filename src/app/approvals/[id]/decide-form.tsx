"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideApproval } from "./actions";

export function DecideForm({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(decision: "approved" | "rejected") {
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    formData.set("decision", decision);
    startTransition(async () => {
      const result = await decideApproval(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("approved")}
          className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("rejected")}
          className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50 bg-secondary hover:bg-foreground/10"
        >
          Reject
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
