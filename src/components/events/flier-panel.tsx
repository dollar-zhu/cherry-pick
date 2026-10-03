"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateFlier, type FlierRequest } from "@/lib/actions/flier";
import { VIBES, getVibe, type VibeId } from "@/lib/flier/design";
import type { FlierView } from "@/lib/flier/store";

type Props = { eventId: string; initial: FlierView | null; loadError: boolean };

const button =
  "rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black";
const secondary =
  "rounded-full border border-zinc-300 px-4 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700";

export function FlierPanel({ eventId, initial, loadError }: Props) {
  const router = useRouter();
  const [flier, setFlier] = useState(initial);
  const [vibe, setVibe] = useState("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(loadError ? "Could not load the flier." : null);
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<FlierRequest["mode"] | null>(null);

  function run(request: FlierRequest) {
    setError(null);
    setRunning(request.mode);
    startTransition(async () => {
      // A network error or function timeout throws instead of returning a result.
      const result = await generateFlier(eventId, request).catch(() => ({
        status: "error" as const,
        message: "The request timed out or failed. Please try again.",
      }));
      setRunning(null);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setFlier(result.flier);
      if (request.mode === "refine") setInstruction("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Vibe</span>
          <select
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            disabled={pending}
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          >
            <option value="">Match the format</option>
            {VIBES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ mode: "new", vibe: (vibe || undefined) as VibeId | undefined })}
          className={button}
        >
          {running === "new" ? "Generating…" : flier ? "New flier" : "Generate flier"}
        </button>
      </div>

      {pending && (
        <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
          {running === "restyle" ? "Setting new fonts…" : "Painting the background — this takes 10–20 seconds."}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {flier ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, already sized */}
          <img
            src={flier.imageUrl}
            alt="Event flier"
            width={1080}
            height={1350}
            className={`aspect-[4/5] w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 ${pending ? "opacity-60" : ""}`}
          />
          <p className="text-xs text-zinc-500">
            Version {flier.version} · {getVibe(flier.vibe).label} · {flier.fontSet} type
            {flier.instruction ? ` · “${flier.instruction}”` : ""}
          </p>
          {flier.fellBack && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Image generation was unavailable, so this version uses a plain background. Try New flier again.
            </p>
          )}
          <form
            className="flex max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (instruction.trim().length >= 2) run({ mode: "refine", instruction });
            }}
          >
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={300}
              disabled={pending}
              placeholder="Refine the background, e.g. darker, more minimal"
              aria-label="Refine the background"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-700"
            />
            <button type="submit" disabled={pending || instruction.trim().length < 2} className={button}>
              {running === "refine" ? "Refining…" : "Refine"}
            </button>
          </form>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => run({ mode: "restyle" })} className={secondary}>
              {running === "restyle" ? "Setting…" : "New fonts"}
            </button>
            <a href={flier.downloadUrl} className={secondary}>
              Download PNG
            </a>
          </div>
        </div>
      ) : (
        !pending && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No flier yet. It uses the event title, date, city and co-hosts — never the budget.
          </p>
        )
      )}
    </div>
  );
}
