import Link from "next/link";

// Same title, same cover color, on every visit.
function coverIndex(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}

// Dates show in the event's own time zone, not the server's.
function dateParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    weekday: "short",
    timeZone,
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), weekday: get("weekday") };
}

/** The "photo" of an event card: a tinted block with the date set large. */
export function EventCover({
  seed,
  date,
  timezone,
  badge,
}: {
  seed: string;
  date: string;
  timezone: string;
  badge?: React.ReactNode;
}) {
  const { day, month, weekday } = dateParts(date, timezone);
  return (
    <div
      style={{ "--cover": `var(--cover-${coverIndex(seed)})` } as React.CSSProperties}
      className="relative flex aspect-[3/2] flex-col min-[480px]:aspect-[4/3] justify-end overflow-hidden rounded-2xl bg-[var(--cover)] p-5 text-ink"
    >
      {badge && <div className="absolute left-3 top-3">{badge}</div>}
      <p className="font-display text-7xl leading-none tracking-[-0.03em] transition-transform duration-[var(--dur-long)] ease-[var(--ease-out)] group-hover:-translate-y-1">
        {day}
      </p>
      <p className="mt-2 text-sm font-medium text-ink/70">
        {month} · {weekday}
      </p>
    </div>
  );
}

/** A small pill that sits on top of a cover. */
export function CoverPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur">
      {children}
    </span>
  );
}

export function EventCard({
  href,
  title,
  city,
  date,
  timezone,
  meta,
  badge,
  index = 0,
}: {
  href: string;
  title: string;
  city: string;
  date: string;
  timezone: string;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  index?: number;
}) {
  return (
    <li className="reveal min-w-0" style={{ "--i": index } as React.CSSProperties}>
      <Link
        href={href}
        className="group block rounded-2xl transition-transform duration-[var(--dur-micro)] ease-[var(--ease-out)] active:scale-[0.99]"
      >
        <EventCover seed={title} date={date} timezone={timezone} badge={badge} />
        <div className="mt-3 flex flex-col gap-0.5 px-0.5">
          <h3 className="truncate font-medium text-ink decoration-ink/30 underline-offset-4 group-hover:underline">
            {title}
          </h3>
          <p className="truncate text-sm text-ink-2">{city}</p>
          {meta && <p className="truncate text-sm text-ink-2">{meta}</p>}
        </div>
      </Link>
    </li>
  );
}

/** Grid for event and invite cards. */
export const cardGrid =
  "grid grid-cols-1 gap-x-6 gap-y-9 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0";
