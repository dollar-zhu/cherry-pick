"use client";

import { useActionState, useState } from "react";
import { buttonPrimary, input } from "@/components/ui";
import { AMENITIES, WEEKDAYS, type Profile } from "@/lib/contracts";
import { saveProfile } from "./actions";

const label = "flex min-w-0 flex-col gap-1.5 text-sm font-medium text-ink";
const section = "flex flex-col gap-6 rounded-3xl border border-rule bg-card p-5 sm:p-8";
const switchInput =
  "relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-rule transition-colors duration-[var(--dur-short)] before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-card before:shadow-sm before:transition-transform before:duration-[var(--dur-short)] before:ease-[var(--ease-out)] checked:bg-ink checked:before:translate-x-4";

const pretty = (value: string) => {
  const text = value.replaceAll("_", " ").replace(/^av\b/, "AV");
  return text[0].toUpperCase() + text.slice(1);
};

function Name({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      {children}
      {hint && <span className="text-xs font-normal text-ink-2">{hint}</span>}
    </span>
  );
}

function SectionHead({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-display text-2xl tracking-[-0.01em] text-ink">{title}</h2>
      <p className="text-sm text-ink-2">{children}</p>
    </div>
  );
}

function Switch({
  title,
  detail,
  ...props
}: { title: string; detail: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 border-t border-rule pt-5 first:border-t-0 first:pt-0">
      <span className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium text-ink">{title}</span>
        <span className="text-ink-2">{detail}</span>
      </span>
      <input type="checkbox" className={switchInput} {...props} />
    </label>
  );
}

function Chips({
  name,
  options,
  checked,
}: {
  name: string;
  options: readonly { value: string | number; label: string }[];
  checked: readonly (string | number)[] | null | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="cursor-pointer select-none whitespace-nowrap rounded-full border border-rule px-3.5 py-1.5 text-sm text-ink transition-[background-color,color,transform] duration-[var(--dur-micro)] hover:border-ink-2/50 active:scale-[0.97] has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--focus)]"
        >
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={checked?.includes(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

const amenityOptions = AMENITIES.map((a) => ({ value: a, label: pretty(a) }));
const weekdayOptions = WEEKDAYS.map((day, index) => ({ value: index, label: day }));

export function ProfileForm({ initial }: { initial: Partial<Profile> | null }) {
  const [state, action, pending] = useActionState(saveProfile, { error: null, values: initial });
  const v = state.values ?? {};
  const [offersVenue, setOffersVenue] = useState(initial?.has_venue ?? false);
  const [amenitiesConfirmed, setAmenitiesConfirmed] = useState(initial?.amenities != null);
  const [weekdaysConfirmed, setWeekdaysConfirmed] = useState(initial?.available_weekdays != null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className={`${section} reveal`} style={{ "--i": 1 } as React.CSSProperties}>
        <SectionHead title="Company">What partners see when we suggest you for an event.</SectionHead>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className={label}>
            Name
            <input name="name" required defaultValue={v.name} className={input} />
          </label>
          <label className={label}>
            City
            <input name="city" required placeholder="San Francisco" defaultValue={v.city} className={input} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Description
            <textarea name="description" required rows={3} defaultValue={v.description} className={`${input} resize-y`} />
          </label>
          <label className={label}>
            <Name hint="Optional">Website</Name>
            <input name="website_url" placeholder="acme.com" defaultValue={v.website_url ?? ""} className={input} />
          </label>
          <label className={label}>
            Audience
            <input
              name="audience"
              required
              placeholder="Early-stage founders and ML engineers"
              defaultValue={v.audience}
              className={input}
            />
          </label>
          <label className={`${label} sm:col-span-2`}>
            <Name hint="Separate with commas">Topics</Name>
            <input
              name="topics"
              required
              placeholder="AI, developer tools, startups"
              defaultValue={v.topics?.join(", ")}
              className={input}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className={`${section} reveal`} style={{ "--i": 2 } as React.CSSProperties}>
        <SectionHead title="Partnerships">Tell us how you want to work with other companies.</SectionHead>
        <div className="flex flex-col gap-5">
          <Switch
            name="is_seeking_partners"
            defaultChecked={v.is_seeking_partners ?? true}
            title="Looking for event partners"
            detail="Other companies can find you and invite you to co-host."
          />
          <Switch
            name="has_venue"
            checked={offersVenue}
            onChange={(event) => setOffersVenue(event.target.checked)}
            title="We have a venue"
            detail="A space where we can host events for partners."
          />
        </div>
      </fieldset>

      {/* Shown only when the company has a venue. */}
      <fieldset disabled={!offersVenue} className={`${section} ${offersVenue ? "reveal" : "hidden"}`} style={{ "--i": 3 } as React.CSSProperties}>
        <SectionHead title="Your venue">Matching uses these details to find events that fit your space.</SectionHead>
        <label className={`${label} sm:max-w-56`}>
          <Name hint="People">Capacity</Name>
          <input name="venue_capacity" type="number" min={1} step={1} defaultValue={v.venue_capacity ?? ""} className={input} />
        </label>

        <div className="flex flex-col gap-4 border-t border-rule pt-6">
          <Switch
            name="amenities_confirmed"
            checked={amenitiesConfirmed}
            onChange={(event) => setAmenitiesConfirmed(event.target.checked)}
            title="I have confirmed the amenities and accessibility"
            detail="Select all that the venue has. Leave all empty if it has none."
          />
          <fieldset disabled={!amenitiesConfirmed} className="transition-opacity duration-[var(--dur-short)] disabled:opacity-40">
            <legend className="sr-only">Amenities</legend>
            <Chips name="amenities" options={amenityOptions} checked={v.amenities} />
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 border-t border-rule pt-6">
          <Switch
            name="weekdays_confirmed"
            checked={weekdaysConfirmed}
            onChange={(event) => setWeekdaysConfirmed(event.target.checked)}
            title="I have confirmed the days the venue is available"
            detail="Select the days. Leave all empty if it is never available."
          />
          <fieldset disabled={!weekdaysConfirmed} className="transition-opacity duration-[var(--dur-short)] disabled:opacity-40">
            <legend className="sr-only">Available days</legend>
            <Chips name="available_weekdays" options={weekdayOptions} checked={v.available_weekdays} />
          </fieldset>
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-rule pt-6 sm:grid-cols-2">
          <label className={label}>
            Available from
            <input name="available_from" type="date" defaultValue={v.available_from ?? ""} className={input} />
          </label>
          <label className={label}>
            Available until
            <input name="available_to" type="date" defaultValue={v.available_to ?? ""} className={input} />
          </label>
        </div>
      </fieldset>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-4 border-t border-rule bg-paper/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:bg-card/90 sm:py-2 sm:pl-5 sm:pr-2 sm:shadow-[var(--shadow-pop)] sm:[bottom:1rem]">
        {state.error && (
          <p role="alert" className="min-w-0 flex-1 text-sm text-accent">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
