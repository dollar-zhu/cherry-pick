import { createHash } from "node:crypto";
import type { EventIntent } from "../intent";

/**
 * Luma-ready event package (SUP-25). Pure: no database, storage or email.
 *
 * Nothing in this codebase posts to Luma. The package is emailed to the
 * organizer, who creates the event in Luma themselves; that hand-off is the
 * "no direct live posting" guarantee.
 */

export const PACKAGE_SCHEMA = "cherry-pick/luma-event@1";

export type Party = "company" | "community";
export const PARTIES: readonly Party[] = ["company", "community"];

/**
 * Assets must live under the launch package's own folder ("<launchPackageId>/...").
 * The server signs download URLs with full storage access, so a path pointing
 * anywhere else could leak another organization's files.
 */
export function isOwnAsset(launchPackageId: string, storagePath: string): boolean {
  return (
    storagePath.startsWith(`${launchPackageId}/`) &&
    !storagePath.split("/").some((seg) => seg === "" || seg === "." || seg === "..")
  );
}

export type Asset = {
  kind: "cover_image" | "image" | "document";
  storagePath: string; // object path in Supabase Storage
  filename: string;
  contentType: string;
};

export type LaunchContent = {
  launchPackageId: string;
  version: number;
  lumaTitle: string;
  lumaDescription: string;
  linkedinCopy: string | null;
  xCopy: string | null;
  assets: Asset[];
};

export type Approval = { party: Party; approvedBy: string; approvedAt: string };

export type LumaPackage = {
  schema: typeof PACKAGE_SCHEMA;
  launchPackageId: string;
  version: number;
  contentHash: string;
  event: {
    name: string;
    description: string;
    startAt: string;
    endAt: string;
    city: string;
    capacity: number;
    format: string;
    coverImage: string | null; // attachment filename
  };
  social: { linkedin: string | null; x: string | null };
  cohosts: Record<Party, string>;
  attachments: { filename: string; kind: Asset["kind"]; contentType: string }[];
  approvals: Approval[];
  instructions: string;
};

/** Stable JSON: object keys sorted at every level, so equal content hashes equally. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Fingerprint of everything the co-hosts approve: event details, copy, the
 * exact asset files and who receives the package. Any change produces a new
 * hash, which voids earlier approvals.
 */
export function contentHash(
  intent: EventIntent,
  content: LaunchContent,
  cohosts: Record<Party, string>,
  organizerEmail: string | null,
): string {
  const approved = {
    schema: PACKAGE_SCHEMA,
    recipient: organizerEmail?.trim().toLowerCase() ?? null,
    launchPackageId: content.launchPackageId,
    version: content.version,
    event: {
      title: content.lumaTitle,
      description: content.lumaDescription,
      start: intent.date_start,
      end: intent.date_end,
      city: intent.city,
      capacity: intent.guest_count,
      format: intent.format,
    },
    social: { linkedin: content.linkedinCopy, x: content.xCopy },
    cohosts,
    assets: content.assets.map((a) => [a.kind, a.storagePath, a.contentType]),
  };
  return createHash("sha256").update(canonical(approved)).digest("hex");
}

export function buildLumaPackage(input: {
  intent: EventIntent;
  content: LaunchContent;
  cohosts: Record<Party, string>;
  organizerEmail: string;
  approvals: Approval[];
}): LumaPackage {
  const { intent, content, cohosts, organizerEmail, approvals } = input;
  const cover = content.assets.find((a) => a.kind === "cover_image") ?? null;
  return {
    schema: PACKAGE_SCHEMA,
    launchPackageId: content.launchPackageId,
    version: content.version,
    contentHash: contentHash(intent, content, cohosts, organizerEmail),
    event: {
      name: content.lumaTitle,
      description: content.lumaDescription,
      startAt: intent.date_start,
      endAt: intent.date_end,
      city: intent.city,
      capacity: intent.guest_count,
      format: intent.format,
      coverImage: cover?.filename ?? null,
    },
    social: { linkedin: content.linkedinCopy, x: content.xCopy },
    cohosts,
    attachments: content.assets.map((a) => ({ filename: a.filename, kind: a.kind, contentType: a.contentType })),
    approvals: [...approvals].sort((a, b) => a.party.localeCompare(b.party)),
    instructions:
      "Create the event in Luma from these fields and upload the cover image. " +
      "This package was approved by both co-hosts; it has not been posted anywhere.",
  };
}
