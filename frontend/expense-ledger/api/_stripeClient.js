import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn("Missing STRIPE_SECRET_KEY — Stripe API calls will fail.");
}

export const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });
