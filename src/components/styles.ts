// Shared class strings. Colors come from the tokens in globals.css.

const press =
  "transition-[transform,opacity,background-color] duration-[var(--dur-micro)] ease-[var(--ease-out)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export const buttonPrimary = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:opacity-90 ${press}`;

export const buttonDark = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-85 ${press}`;

export const buttonQuiet = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-rule bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-paper-2 ${press}`;

export const input =
  "w-full rounded-xl border border-rule bg-card px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors duration-[var(--dur-micro)] placeholder:text-ink-2/60 hover:border-ink-2/40 focus:border-ink focus-visible:outline-none";

export const pageTitle = "font-display text-4xl tracking-[-0.02em] text-ink sm:text-5xl";
