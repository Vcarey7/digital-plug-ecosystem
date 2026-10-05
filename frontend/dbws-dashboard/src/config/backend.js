// Phase 3's own backend (backend/dns-checkout) -- holds Namecheap/Stripe
// secrets server-side and brokers DNS availability/pricing/checkout. This
// dashboard never talks to Supabase or Namecheap/Stripe directly.
export const DNS_API_URL = import.meta.env.VITE_DNS_API_URL || 'http://localhost:4100';

export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

async function request(path, options = {}) {
  const res = await fetch(`${DNS_API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request to ${path} failed (${res.status})`);
  return body;
}

export function searchDnsAvailability(domain) {
  return request(`/api/domains/search?domain=${encodeURIComponent(domain)}`);
}

export function createDnsCheckout({ domain, years, customerEmail, idempotencyKey, contact }) {
  return request('/api/checkout/dns', {
    method: 'POST',
    body: JSON.stringify({ domain, years, customerEmail, idempotencyKey, contact }),
  });
}

export function recordOnchainOrder({ domain, txHash, walletAddress, amountUsdc6dp, idempotencyKey }) {
  return request('/api/orders/onchain', {
    method: 'POST',
    body: JSON.stringify({ domain, txHash, walletAddress, amountUsdc6dp, idempotencyKey }),
  });
}

export function listOrders({ email, wallet }) {
  const qs = email ? `email=${encodeURIComponent(email)}` : `wallet=${encodeURIComponent(wallet)}`;
  return request(`/api/orders?${qs}`);
}
