"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useState, useTransition } from "react";
import { createEvent } from "@/lib/actions/events";
import { formatBudget, intentSchema, type EventIntent } from "@/lib/intent";
import { formatWeekdays } from "@/lib/matching-constraints";

// Times in the event's own time zone, not the viewer's.
const formatDate = (value: string, timeZone: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));


function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function Details({ intent }: { intent: EventIntent }) {
  return (
    <dl className="flex flex-col gap-1.5">
      <Row label="Topic">{intent.topic}</Row>
      <Row label="Goal">{intent.goal}</Row>
      <Row label="Format">{intent.format}</Row>
      <Row label="City">{intent.city}</Row>
      <Row label="When">
        {intent.dates_flexible && "Any time between "}
        {formatDate(intent.date_start, intent.timezone)} – {formatDate(intent.date_end, intent.timezone)}
      </Row>
      {intent.dates_flexible && <Row label="Weekdays">{intent.allowed_weekdays ? formatWeekdays(intent.allowed_weekdays) : "Any"}</Row>}
      <Row label="Venue">{intent.needs_venue ? "A partner provides it" : "Not needed"}</Row>
      {intent.needs_venue && (
        <Row label="Must have">{intent.required_amenities.join(", ") || "Nothing specific"}</Row>
      )}
      <Row label="Guests">{intent.guest_count}</Row>
      <Row label="Budget cap">{formatBudget(intent.budget_cap_cents, intent.currency)}</Row>
      <Row label="Sales boundary">{intent.sales_boundary}</Row>
      <Row label="Partner criteria">{intent.partner_criteria}</Row>
    </dl>
  );
}

export function IntentProposal({ intent, toolCallId }: { intent: EventIntent; toolCallId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      // On success createEvent redirects; it only returns on failure.
      const result = await createEvent({ intent, toolCallId });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section
      aria-label="Proposed event"
      className="my-2 flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="text-base font-semibold">{intent.title}</h2>
      <Details intent={intent} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
        >
          {pending ? "Creating…" : "Confirm intent"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

export const IntentCard: ToolCallMessagePartComponent = ({ args, status, isError, toolCallId }) => {
  if (status.type === "running") {
    return <p className="text-sm text-zinc-500">Drafting the event…</p>;
  }

  const parsed = intentSchema.safeParse(args);
  // Invalid input goes back to the model, which asks the user for the missing field.
  if (isError || !parsed.success) return null;

  return <IntentProposal intent={parsed.data} toolCallId={toolCallId} />;
};
