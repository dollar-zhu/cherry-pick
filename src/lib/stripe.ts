import Stripe from "stripe";

let stripe: Stripe | undefined;

// Lazy so `next build` can collect route config without STRIPE_SECRET_KEY set.
export function getStripe() {
  return (stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!));
}
