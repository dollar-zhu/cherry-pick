"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateFlier, type FlierRequest } from "@/lib/actions/flier";
import { VIBES, getVibe, type VibeId } from "@/lib/flier/design";
import type { FlierView } from "@/lib/flier/store";
import { buttonDark, buttonPrimary, buttonQuiet, input } from "@/components/styles";

type Props = { eventId: string; initial: FlierView | null; loadError: boolean };

const chip =
  "cursor-pointer select-none whitespace-nowrap rounded-full border border-rule px-3.5 py-1.5 text-sm text-ink transition-[background-color,color,transform] duration-[var(--dur-micro)] hover:border-ink-2/50 active:scale-[0.97] has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-disabled:pointer-events-none has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--focus)]";

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

  const vibes = [{ id: "", label: "Match the format" }, ...VIBES];

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* Preview: the flier, or a placeholder in the same 4:5 shape. */}
      <div className="relative">
        {flier ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, already sized
          <img
            src={flier.imageUrl}
            alt="Event flier"
            width={1080}
            height={1350}
            className={`aspect-[4/5] w-full rounded-2xl border border-rule object-cover shadow-[var(--shadow-pop)] transition-opacity duration-[var(--dur-short)] ${pending ? "opacity-50" : ""}`}
          />
        ) : (
          <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-2/40 bg-paper-2 p-6 text-center">
            <p className="font-display text-2xl text-ink">No flier yet</p>
            <p className="text-sm text-ink-2">It uses the title, date, city and co-hosts. Never the budget.</p>
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 flex items-end justify-center p-4">
            <span role="status" className="rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm backdrop-blur">
              {running === "restyle" ? "Setting new fonts…" : "Painting the background, 10–20 seconds…"}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <fieldset className="flex flex-col gap-3" disabled={pending}>
          <legend className="mb-3 text-sm font-medium text-ink">Vibe</legend>
          <div className="flex flex-wrap gap-2">
            {vibes.map((v) => (
              <label key={v.id || "auto"} className={chip}>
                <input
                  type="radio"
                  name="flier-vibe"
                  value={v.id}
                  checked={vibe === v.id}
                  onChange={() => setVibe(v.id)}
                  className="sr-only"
                />
                {v.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          disabled={pending}
          onClick={() => run({ mode: "new", vibe: (vibe || undefined) as VibeId | undefined })}
          className={`${buttonPrimary} self-start`}
        >
          {running === "new" ? "Generating…" : flier ? "Generate a new flier" : "Generate flier"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-brand">
            {error}
          </p>
        )}

        {flier && (
          <div className="flex flex-col gap-4 border-t border-rule pt-6">
            <p className="text-sm text-ink-2">
              Version {flier.version} · {getVibe(flier.vibe).label} · {flier.fontSet} type
              {flier.instruction ? ` · “${flier.instruction}”` : ""}
            </p>
            {flier.fellBack && (
              <p className="rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink">
                Image generation was unavailable, so this version uses a plain background. Generate it again.
              </p>
            )}
            <form
              className="flex gap-2"
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
                className={`${input} min-w-0 flex-1 text-sm`}
              />
              <button type="submit" disabled={pending || instruction.trim().length < 2} className={buttonDark}>
                {running === "refine" ? "Refining…" : "Refine"}
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => run({ mode: "restyle" })} className={buttonQuiet}>
                {running === "restyle" ? "Setting…" : "New fonts"}
              </button>
              <a href={flier.downloadUrl} className={buttonQuiet}>
                Download PNG
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
