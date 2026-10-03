"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findMatches } from "@/lib/actions/matching";

type Props = { eventId: string };

export function FindMatchesButton({ eventId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "error"; message: string } | { kind: "ranking_failed" } | null
  >(null);

  function run() {
    setFeedback(null);
    startTransition(async () => {
      const result = await findMatches(eventId);
      if (result.status === "error") {
        setFeedback({ kind: "error", message: result.message });
      } else {
        if (result.status === "ok" && result.rankingFailed) {
          setFeedback({ kind: "ranking_failed" });
        }
        // Refresh server-rendered candidates without a full navigation.
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
        >
          {pending ? "Finding…" : "Find matches"}
        </button>
        {feedback?.kind === "error" && (
          <p role="alert" className="text-sm text-red-600">
            {feedback.message}
          </p>
        )}
      </div>
      {feedback?.kind === "ranking_failed" && (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          Ranking unavailable — showing unranked results.
        </p>
      )}
    </div>
  );
}
