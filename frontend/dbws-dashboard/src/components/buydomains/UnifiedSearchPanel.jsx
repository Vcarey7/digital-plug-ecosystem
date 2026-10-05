import React, { useState } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Globe, Link2, PlusCircle } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useCart } from '../../contexts/CartContext';
import { useNotification } from '../../contexts/NotificationContext';
import { searchDnsAvailability } from '../../config/backend';
import { formatUSDC } from '../../lib/format';

// Phase 3: one search box, two rails. The DNS half goes through our own
// backend (Namecheap secrets never reach the browser); the on-chain half
// reads PlugRegistry directly, exactly like DomainSearchPanel does for the
// dedicated Plug Registry view -- this is a second, additive entry point
// into the same contract, not a replacement for it.
export default function UnifiedSearchPanel() {
  const { getContract } = useWeb3();
  const { addItem } = useCart();
  const { showSuccess, showError } = useNotification();

  const [domain, setDomain] = useState('');
  const [checking, setChecking] = useState(false);
  const [dnsResult, setDnsResult] = useState(null);
  const [dnsError, setDnsError] = useState(null);
  const [onchainResult, setOnchainResult] = useState(null);

  const clean = domain.trim().toLowerCase();

  const handleSearch = async () => {
    if (!clean.includes('.')) return showError('Enter a full domain', 'e.g. vance.plug or vance.com');
    setChecking(true);
    setDnsResult(null);
    setDnsError(null);
    setOnchainResult(null);

    const dot = clean.indexOf('.');
    const name = clean.slice(0, dot);
    const tld = clean.slice(dot + 1);

    const dnsPromise = searchDnsAvailability(clean).catch((e) => {
      setDnsError(e.message);
      return null;
    });

    const onchainPromise = (async () => {
      try {
        const registry = getContract('PlugRegistry');
        const [available, enabled, feePerYear] = await Promise.all([
          registry.isAvailable(tld, name),
          registry.tldEnabled(tld),
          registry.registrationFee(tld),
        ]);
        return { available, enabled, feePerYear, name, tld };
      } catch {
        return null; // not an on-chain TLD at all, or addresses not loaded -- quietly skip this rail
      }
    })();

    const [dns, onchain] = await Promise.all([dnsPromise, onchainPromise]);
    if (dns) setDnsResult(dns);
    setOnchainResult(onchain);
    setChecking(false);
  };

  const addDnsToCart = () => {
    addItem({ domain: clean, kind: 'dns', years: 1, priceCents: dnsResult.retailPriceCents });
    showSuccess('Added to cart', `${clean} (DNS)`);
  };

  const addOnchainToCart = () => {
    addItem({
      domain: clean,
      kind: 'onchain',
      years: 1,
      name: onchainResult.name,
      tld: onchainResult.tld,
      feePerYear: onchainResult.feePerYear.toString(),
    });
    showSuccess('Added to cart', `${clean} (on-chain)`);
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="vance.plug or vance.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={!clean || checking} className="btn-primary flex items-center gap-2">
          {checking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      {(dnsResult || dnsError || onchainResult) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ResultCard
            icon={Globe}
            title="Traditional DNS"
            subtitle={dnsError || (dnsResult ? `.${dnsResult.tld}` : 'checking…')}
            available={dnsResult?.available && dnsResult?.active}
            priceLabel={dnsResult?.active ? `${(dnsResult.retailPriceCents / 100).toFixed(2)} USD/yr` : dnsResult && !dnsResult.active ? 'not sold' : null}
            onAdd={dnsResult?.available && dnsResult?.active ? addDnsToCart : null}
          />
          <ResultCard
            icon={Link2}
            title="On-chain (Plug Registry)"
            subtitle={onchainResult ? `.${onchainResult.tld}` : 'not an on-chain TLD'}
            available={onchainResult?.available && onchainResult?.enabled}
            priceLabel={onchainResult?.enabled ? `${formatUSDC(onchainResult.feePerYear)}/yr` : onchainResult ? 'TLD not enabled' : null}
            onAdd={onchainResult?.available && onchainResult?.enabled ? addOnchainToCart : null}
          />
        </div>
      )}
    </div>
  );
}

function ResultCard({ icon: Icon, title, subtitle, available, priceLabel, onAdd }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--surface2)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-[var(--gold)]" />
        <span className="font-display font-semibold text-sm text-[var(--text)]">{title}</span>
      </div>
      <p className="text-xs text-[var(--text3)]">{subtitle}</p>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-xs">
          {available === true && <><CheckCircle2 size={14} style={{ color: 'var(--green)' }} /> available</>}
          {available === false && <><XCircle size={14} style={{ color: 'var(--red)' }} /> unavailable</>}
        </div>
        {priceLabel && <span className="text-xs font-mono text-[var(--gold)]">{priceLabel}</span>}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="btn-secondary w-full mt-3 flex items-center justify-center gap-1.5 !py-1.5">
          <PlusCircle size={12} /> Add to cart
        </button>
      )}
    </div>
  );
}
