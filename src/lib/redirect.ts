/** Same-origin path only. Rejects protocol-relative and backslash tricks. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value.includes("://")) return null;
  return value;
}
