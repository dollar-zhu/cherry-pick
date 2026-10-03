import { z } from "zod";
import { AMENITIES } from "@/lib/contracts";

/**
 * The structured "event intent" the assistant proposes and the user confirms.
 * Shared by the `propose_event_intent` tool (input schema), the IntentCard
 * (client-side check before enabling Confirm) and `createEvent` (re-validation
 * before insert). Keep in sync with `supabase/migrations/0003_events.sql` and
 * `0005_event_matching.sql`.
 */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .describe("ISO 8601 date-time with UTC offset, e.g. 2026-11-14T19:00:00+01:00");

export const intentSchema = z
  .object({
    title: text(3, 120).describe("Short public name of the event"),
    topic: text(2, 200).describe("Subject the event is about"),
    goal: text(2, 500).describe("What the host wants the event to achieve"),
    format: text(2, 80).describe("Event format, e.g. dinner, panel, workshop, mixer"),
    city: text(2, 120).describe("City where the event takes place"),
    date_start: isoDateTime,
    date_end: isoDateTime,
    guest_count: z
      .number()
      .int()
      .min(1)
      .max(10_000)
      .describe("Expected number of guests"),
    budget_cap_cents: z
      .number()
      .int()
      .min(0)
      .max(10_000_000_000)
      .describe("Maximum total budget in minor units of `currency`, e.g. 300000 for 3,000.00"),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use an uppercase ISO 4217 code")
      .describe("ISO 4217 currency code of the budget, e.g. EUR or USD"),
    sales_boundary: text(2, 500).describe(
      "What selling or pitching is and is not allowed at the event",
    ),
    partner_criteria: text(2, 1000).describe(
      "Requirements a sponsor or partner must meet",
    ),
    needs_venue: z.boolean().describe("True if a partner must provide the venue"),
    dates_flexible: z
      .boolean()
      .describe(
        "False: date_start and date_end are the event itself. True: they are the earliest and latest possible dates",
      ),
    allowed_weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .nullable()
      .describe("Only when dates_flexible: possible days, 0 = Sunday ... 6 = Saturday. null = any day"),
    required_amenities: z
      .array(z.enum(AMENITIES))
      .describe("Things the venue must have. [] = none"),
  })
  .refine((intent) => Date.parse(intent.date_end) >= Date.parse(intent.date_start), {
    message: "date_end must be on or after date_start",
    path: ["date_end"],
  })
  .refine((intent) => intent.dates_flexible || intent.allowed_weekdays === null, {
    message: "allowed_weekdays is only for flexible dates; set it to null or set dates_flexible",
    path: ["allowed_weekdays"],
  })
  .refine((intent) => intent.needs_venue || intent.required_amenities.length === 0, {
    message: "required_amenities needs needs_venue to be true",
    path: ["required_amenities"],
  });

export type EventIntent = z.infer<typeof intentSchema>;

export function formatBudget(cents: number, currency: string, locale?: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Chat request limits, enforced by /api/chat and mirrored in the composer. */
export const CHAT_MAX_MESSAGES = 30;
export const CHAT_MAX_MESSAGE_CHARS = 4000;
