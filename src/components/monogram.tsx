/** Company initials in a round tile. Stands in for a logo. */
export function Monogram({ name, className = "" }: { name: string; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "?";

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-medium text-paper ${className}`}
    >
      {initials}
    </span>
  );
}
