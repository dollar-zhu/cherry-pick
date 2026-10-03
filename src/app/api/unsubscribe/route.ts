import { unsubscribeByToken } from "@/lib/outreach/unsubscribe";

/** RFC 8058 one-click unsubscribe, posted by mail clients from the List-Unsubscribe header. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  try {
    const email = await unsubscribeByToken(token);
    if (!email) return new Response("Invalid unsubscribe link", { status: 400 });
    return new Response("Unsubscribed", { status: 200 });
  } catch (e) {
    console.error("[unsubscribe]", e);
    return new Response("Could not unsubscribe, please try again", { status: 500 });
  }
}

/** A person who opens the header URL gets the confirmation page instead. */
export function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/unsubscribe", url.origin);
  const token = url.searchParams.get("t");
  if (token) target.searchParams.set("t", token);
  return Response.redirect(target, 303);
}
