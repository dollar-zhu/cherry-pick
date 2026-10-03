"use client";

import { buttonVariants } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findMatches } from "@/lib/actions/matching";

type Props = { eventId: string };

export function FindMatchesButton({ eventId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "error"; message: string } | { kind: "ranking_failed" } | { kind: "empty" } | null
  >(null);

  function run() {
    setFeedback(null);
    startTransition(async () => {
      const result = await findMatches(eventId);
      if (result.status === "error") {
        setFeedback({ kind: "error", message: result.message });
        return;
      }
      if (result.status === "empty") {
        setFeedback({ kind: "empty" });
      } else if (result.rankingFailed) {
        setFeedback({ kind: "ranking_failed" });
      }
      // Refresh server-rendered candidates without a full navigation.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className={buttonVariants({ variant: "brand" })}
        >
          {pending ? "Finding…" : "Find matches"}
        </button>
        {feedback?.kind === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {feedback.message}
          </p>
        )}
      </div>
      {feedback?.kind === "empty" && (
        <p role="status" className="text-sm text-muted-foreground">
          No organizations matched these constraints.
        </p>
      )}
      {feedback?.kind === "ranking_failed" && (
        <p
          role="alert"
          className="rounded-field border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning"
        >
          Ranking unavailable — showing unranked results.
        </p>
      )}
    </div>
  );
}
