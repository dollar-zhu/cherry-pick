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
          className="rounded-full bg-ink px-4 py-2 text-sm text-paper font-medium transition-[transform,opacity] duration-[var(--dur-micro)] active:scale-[0.98] disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("rejected")}
          className="rounded-full border border-rule px-4 py-2 text-sm disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-brand">{error}</p>}
    </div>
  );
}
