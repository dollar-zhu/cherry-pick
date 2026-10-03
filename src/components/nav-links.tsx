"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: number };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || (pathname.startsWith("/events/") && pathname !== "/events/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                active
                  ? "bg-foreground/10 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="max-w-40 truncate">{item.label}</span>
              {item.badge ? (
                <span
                  aria-label={`${item.badge} waiting`}
                  className={`rounded-full px-1.5 text-xs font-medium ${
                    active ? "bg-foreground/20" : "bg-warning/15 text-warning"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
