import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    client_reference_id: claims.sub,
    customer_email: typeof claims.email === "string" ? claims.email : undefined,
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
