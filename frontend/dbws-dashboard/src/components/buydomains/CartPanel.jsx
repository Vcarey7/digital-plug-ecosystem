import React from 'react';
import { ShoppingCart, Trash2, Globe, Link2 } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { formatUSDC } from '../../lib/format';
import DnsCheckoutItem from './DnsCheckoutItem';
import OnchainCheckoutItem from './OnchainCheckoutItem';

export default function CartPanel() {
  const { items, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="card p-8 text-center">
        <ShoppingCart size={22} className="mx-auto mb-2 text-[var(--text3)]" />
        <p className="text-sm text-[var(--text2)]">Your cart is empty — search above and add a name.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display font-bold text-sm text-[var(--text)] flex items-center gap-2">
        <ShoppingCart size={16} /> Cart ({items.length})
      </h3>
      {items.map((item) => (
        <div key={item.id} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.kind === 'dns' ? <Globe size={14} className="text-[var(--gold)]" /> : <Link2 size={14} className="text-[var(--gold)]" />}
              <span className="font-mono text-sm text-[var(--text)]">{item.domain}</span>
              <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                {item.kind === 'dns' ? 'Traditional DNS' : 'On-chain'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[var(--gold)]">
                {item.kind === 'dns' ? `$${(item.priceCents / 100).toFixed(2)}` : formatUSDC(BigInt(item.feePerYear))}/yr
              </span>
              <button onClick={() => removeItem(item.id)} className="text-[var(--text3)] hover:text-[var(--red)]">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {item.kind === 'dns' ? (
            <DnsCheckoutItem item={item} onDone={() => removeItem(item.id)} />
          ) : (
            <OnchainCheckoutItem item={item} onDone={() => removeItem(item.id)} />
          )}
        </div>
      ))}
    </div>
  );
}
