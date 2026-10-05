import Stripe from 'stripe';
import { env } from '../lib/env.js';

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured (missing STRIPE_SECRET_KEY)');
    this.name = 'StripeNotConfiguredError';
  }
}

let _stripe = null;
function client() {
  if (!env.stripe.isConfigured()) throw new StripeNotConfiguredError();
  if (!_stripe) _stripe = new Stripe(env.stripe.secretKey);
  return _stripe;
}

/**
 * amountCents is an integer (USD cents) -- the hard rule against float
 * money amounts applies here too, not just in the database.
 */
export async function createPaymentIntent({ amountCents, domain, customerEmail, idempotencyKey }) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error(`amountCents must be a non-negative integer, got ${amountCents}`);
  }
  return client().paymentIntents.create(
    {
      amount: amountCents,
      currency: 'usd',
      metadata: { domain, customerEmail: customerEmail || '' },
      receipt_email: customerEmail || undefined,
    },
    { idempotencyKey }
  );
}

/** Verifies and parses a Stripe webhook payload. Throws on a bad signature. */
export function constructWebhookEvent(rawBody, signature) {
  if (!env.stripe.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  return client().webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}
