export function siteUrl() {
  // On Vercel, fall back to the production domain so MCP links never say localhost.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}

export function supabaseAuthIssuer() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  return `${raw.replace(/\/$/, "")}/auth/v1`;
}
