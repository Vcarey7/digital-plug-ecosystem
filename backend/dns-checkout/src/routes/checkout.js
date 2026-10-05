import express from 'express';
import { supabase } from '../lib/supabase.js';
import { createPaymentIntent, constructWebhookEvent } from '../services/stripe.js';
import { registerDomain, NamecheapNotConfiguredError } from '../services/namecheap.js';
import {
  upsertCustomer,
  createPendingOrder,
  attachStripePaymentIntent,
  findOrderByPaymentIntent,
  setOrderStatus,
} from '../services/orders.js';

export const checkoutRouter = express.Router();

// POST /api/checkout/dns
// Body: { domain, years, customerEmail, idempotencyKey, contact: {...} }
// Creates a pending order + a Stripe PaymentIntent. Registration itself
// happens later, in the webhook, only after Stripe confirms payment --
// never on this request, so a dropped response can't register a domain
// nobody paid for.
checkoutRouter.post('/dns', async (req, res) => {
  const { domain, years = 1, customerEmail, idempotencyKey, contact } = req.body || {};
  if (!domain || !customerEmail || !idempotencyKey || !contact) {
    return res.status(400).json({ error: 'domain, customerEmail, idempotencyKey, and contact are required' });
  }

  try {
    const tld = domain.slice(domain.indexOf('.') + 1);
    const { data: pricing, error: priceErr } = await supabase
      .from('dns_tlds')
      .select('*')
      .eq('tld', tld)
      .eq('active', true)
      .maybeSingle();
    if (priceErr) throw priceErr;
    if (!pricing) return res.status(422).json({ error: `.${tld} is not currently sold` });

    const amountCents = pricing.retail_price * years;
    const customer = await upsertCustomer({ email: customerEmail });
    const { order } = await createPendingOrder({
      customerId: customer.id,
      domain,
      type: 'dns',
      amount: amountCents,
      currency: 'usd_cents',
      idempotencyKey,
      years,
    });

    // Order already has a PaymentIntent (a retried checkout request) --
    // return the existing one instead of creating a second charge.
    if (order.stripe_payment_intent_id) {
      return res.json({ orderId: order.id, clientSecret: null, reused: true, status: order.status });
    }

    const pi = await createPaymentIntent({
      amountCents,
      domain,
      customerEmail,
      idempotencyKey: `pi_${idempotencyKey}`,
    });
    await attachStripePaymentIntent(order.id, pi.id);
    // Contact details are needed at registration time (the webhook), not
    // before payment -- stash them on the PaymentIntent's metadata would
    // leak PII into Stripe's dashboard, so instead keep them client-side
    // and have the webhook handler require them to be replayed... In
    // practice: store them encrypted or in a side table. Flagging this as
    // a deliberate simplification for Phase 3's first pass; see README.
    pendingContacts.set(order.id, contact);

    res.json({ orderId: order.id, clientSecret: pi.client_secret, reused: false, amountCents });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// In-memory stash for registrant contact info between PaymentIntent
// creation and webhook confirmation. Fine for a single-process dev/sandbox
// deployment; NOT durable across restarts or multiple instances -- a real
// production deploy should persist this (its own table, or encrypted
// alongside the order) instead. Flagged in README.md's "Known gaps".
const pendingContacts = new Map();

// POST /api/checkout/stripe-webhook
// Mounted with express.raw() in index.js -- Stripe signature verification
// needs the exact raw bytes, not a re-serialized JSON body.
checkoutRouter.post('/stripe-webhook', async (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (e) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${e.message}` });
  }

  if (event.type !== 'payment_intent.succeeded') {
    return res.json({ received: true, ignored: event.type });
  }

  const pi = event.data.object;
  try {
    const order = await findOrderByPaymentIntent(pi.id);
    if (!order) return res.status(404).json({ error: `No order for PaymentIntent ${pi.id}` });

    // Idempotent: a webhook Stripe retries (or redelivers) must not
    // register the domain a second time.
    if (order.status === 'registered') return res.json({ received: true, alreadyRegistered: true });

    const contact = pendingContacts.get(order.id);
    if (!contact) {
      await setOrderStatus(order.id, 'failed');
      return res.status(500).json({ error: `No registrant contact on file for order ${order.id}` });
    }

    await registerDomain(order.domain, order.years, contact);
    await setOrderStatus(order.id, 'registered');
    pendingContacts.delete(order.id);
    res.json({ received: true, registered: true });
  } catch (e) {
    if (e instanceof NamecheapNotConfiguredError) {
      return res.status(503).json({ error: e.message });
    }
    res.status(502).json({ error: e.message });
  }
});

// POST /api/orders/onchain
// Body: { domain, txHash, walletAddress, amountUsdc6dp, idempotencyKey }
// The on-chain purchase itself already happened (the user's wallet called
// PlugRegistry directly) -- this just records it in the unified orders
// table so order history spans both DNS and on-chain purchases.
checkoutRouter.post('/onchain', async (req, res) => {
  const { domain, txHash, walletAddress, amountUsdc6dp, idempotencyKey } = req.body || {};
  if (!domain || !txHash || !walletAddress || amountUsdc6dp == null || !idempotencyKey) {
    return res.status(400).json({ error: 'domain, txHash, walletAddress, amountUsdc6dp, idempotencyKey are required' });
  }
  if (!Number.isInteger(amountUsdc6dp) || amountUsdc6dp < 0) {
    return res.status(400).json({ error: 'amountUsdc6dp must be a non-negative integer (USDC 6dp units)' });
  }

  try {
    const customer = await upsertCustomer({ walletAddress });
    const { order, created } = await createPendingOrder({
      customerId: customer.id,
      domain,
      type: 'onchain',
      amount: amountUsdc6dp,
      currency: 'usdc_6dp',
      idempotencyKey,
    });
    if (created) {
      await supabase.from('orders').update({ tx_hash: txHash }).eq('id', order.id);
      await setOrderStatus(order.id, 'registered');
    }
    res.json({ orderId: order.id, created });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
