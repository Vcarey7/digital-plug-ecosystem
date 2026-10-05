import React from 'react';
import UnifiedSearchPanel from '../components/buydomains/UnifiedSearchPanel';
import CartPanel from '../components/buydomains/CartPanel';

// Phase 3: one storefront for both rails -- traditional DNS (Namecheap +
// Stripe, via backend/dns-checkout) and on-chain Plug Registry names (USDC,
// via the existing commit-reveal flow) in the same search-to-cart-to-
// checkout experience. Does not touch the dedicated Plug Registry view's
// own search/register/manage flow -- this is an additive entry point.
export default function BuyDomainsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">Buy a Domain</h2>
        <p className="text-sm text-[var(--text2)] mt-1">
          Search once, see both a real browser-resolving domain and an on-chain .plug/.dbws name, and check out either (or both) here.
        </p>
      </div>

      <UnifiedSearchPanel />
      <CartPanel />
    </div>
  );
}
