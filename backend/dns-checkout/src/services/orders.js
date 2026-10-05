import { supabase } from '../lib/supabase.js';

/** Finds or creates a customer by email and/or wallet address. */
export async function upsertCustomer({ email, walletAddress }) {
  if (!email && !walletAddress) throw new Error('upsertCustomer requires email or walletAddress');

  const match = email
    ? supabase.from('customers').select('*').eq('email', email).maybeSingle()
    : supabase.from('customers').select('*').eq('wallet_address', walletAddress).maybeSingle();
  const { data: existing, error: findErr } = await match;
  if (findErr) throw findErr;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('customers')
    .insert({ email, wallet_address: walletAddress })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Creates a pending order, or returns the existing one if `idempotencyKey`
 * was already used -- the whole point being a retried request (a flaky
 * network retry, a duplicated webhook) can never create two orders or
 * register a domain twice.
 */
export async function createPendingOrder({ customerId, domain, type, amount, currency, idempotencyKey, years = 1 }) {
  const { data: existing, error: findErr } = await supabase
    .from('orders')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return { order: existing, created: false };

  const { data, error } = await supabase
    .from('orders')
    .insert({ customer_id: customerId, domain, type, amount, currency, idempotency_key: idempotencyKey, years })
    .select()
    .single();
  if (error) throw error;
  return { order: data, created: true };
}

export async function attachStripePaymentIntent(orderId, paymentIntentId) {
  const { data, error } = await supabase
    .from('orders')
    .update({ stripe_payment_intent_id: paymentIntentId, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findOrderByPaymentIntent(paymentIntentId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setOrderStatus(orderId, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listOrdersFor({ email, walletAddress }) {
  const customer = email
    ? await supabase.from('customers').select('id').eq('email', email).maybeSingle()
    : await supabase.from('customers').select('id').eq('wallet_address', walletAddress).maybeSingle();
  if (customer.error) throw customer.error;
  if (!customer.data) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customer.data.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
