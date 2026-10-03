"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonPrimary } from "./ui";

export function NavLinks({ waiting }: { waiting: number }) {
  const pathname = usePathname();
  const inboxActive = pathname === "/inbox";
  const planActive = pathname === "/events/new";

  return (
    <>
      <Link
        href="/inbox"
        aria-current={inboxActive ? "page" : undefined}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm transition-colors duration-[var(--dur-micro)] ${
          inboxActive ? "bg-paper-2 text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
        }`}
      >
        Inbox
        {waiting > 0 && (
          <span
            aria-label={`${waiting} waiting`}
            className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-medium leading-5 text-accent-ink"
          >
            {waiting}
          </span>
        )}
      </Link>
      <Link
        href="/events/new"
        aria-current={planActive ? "page" : undefined}
        aria-label="Plan an event"
        className={`${buttonPrimary} ${planActive ? "pointer-events-none" : ""}`}
      >
        <span aria-hidden className="text-base leading-none">+</span>
        <span>
          Plan<span className="hidden sm:inline"> an event</span>
        </span>
      </Link>
    </>
  );
}
