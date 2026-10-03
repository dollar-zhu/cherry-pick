"use client";

import { useActionState, useState } from "react";
import { AMENITIES, WEEKDAYS, type Profile } from "@/lib/contracts";
import { saveProfile } from "./actions";

const input =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-black";
const label = "flex flex-col gap-1 text-sm";
const legend = "mb-1 text-sm font-medium";
const fieldset = "flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800";

const pretty = (value: string) => value.replaceAll("_", " ");

function Checkboxes({
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
          className="flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1 text-sm has-checked:border-zinc-900 has-checked:bg-zinc-100 dark:border-zinc-700 dark:has-checked:border-zinc-100 dark:has-checked:bg-zinc-900"
        >
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={checked?.includes(option.value)}
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
    <form action={action} className="flex flex-col gap-5">
      <fieldset className={fieldset}>
        <legend className={legend}>Company</legend>
        <label className={label}>
          Name
          <input name="name" required defaultValue={v.name} className={input} />
        </label>
        <label className={label}>
          Description
          <textarea name="description" required rows={3} defaultValue={v.description} className={input} />
        </label>
        <label className={label}>
          City
          <input name="city" required placeholder="San Francisco" defaultValue={v.city} className={input} />
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
        <label className={label}>
          Topics (comma-separated)
          <input
            name="topics"
            required
            placeholder="AI, developer tools, startups"
            defaultValue={v.topics?.join(", ")}
            className={input}
          />
        </label>
        <label className={label}>
          Website (optional)
          <input name="website_url" placeholder="acme.com" defaultValue={v.website_url ?? ""} className={input} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_seeking_partners" defaultChecked={v.is_seeking_partners ?? true} />
          We are actively looking for event partners
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="has_venue" checked={offersVenue}
            onChange={(event) => setOffersVenue(event.target.checked)} />
          We have a venue where we can host events
        </label>
      </fieldset>

      {/* Shown only when the company has a venue. */}
      <fieldset disabled={!offersVenue} className={`${fieldset} ${offersVenue ? "" : "hidden"}`}>
        <legend className={legend}>Your venue</legend>
        <label className={label}>
          Capacity (people)
          <input name="venue_capacity" type="number" min={1} step={1} defaultValue={v.venue_capacity ?? ""} className={input} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="amenities_confirmed" checked={amenitiesConfirmed}
            onChange={(event) => setAmenitiesConfirmed(event.target.checked)} />
          I have confirmed the venue amenities and accessibility
        </label>
        <fieldset disabled={!amenitiesConfirmed} className="disabled:opacity-50">
          <legend className="mb-2 text-sm">Select all available amenities (leave empty if none)</legend>
          <Checkboxes name="amenities" options={amenityOptions} checked={v.amenities} />
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="weekdays_confirmed" checked={weekdaysConfirmed}
            onChange={(event) => setWeekdaysConfirmed(event.target.checked)} />
          I have confirmed which days the venue is available
        </label>
        <fieldset disabled={!weekdaysConfirmed} className="disabled:opacity-50">
          <legend className="mb-2 text-sm">Select available days (leave empty if none)</legend>
          <Checkboxes name="available_weekdays" options={weekdayOptions} checked={v.available_weekdays} />
        </fieldset>
        <div className="flex gap-3">
          <label className={`${label} flex-1`}>
            Available from
            <input name="available_from" type="date" defaultValue={v.available_from ?? ""} className={input} />
          </label>
          <label className={`${label} flex-1`}>
            Available until
            <input name="available_to" type="date" defaultValue={v.available_to ?? ""} className={input} />
          </label>
        </div>
      </fieldset>

      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-zinc-900 px-5 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
