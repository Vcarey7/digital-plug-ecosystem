import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Lock, RefreshCw, Send, Globe } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useNotification } from '../../contexts/NotificationContext';
import { formatUSDC, formatDate, isExpired } from '../../lib/format';

export default function MyDomainsList() {
  const { account, addresses, getContract, ensureAllowance } = useWeb3();
  const { showSuccess, showError } = useNotification();

  const [domains, setDomains] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const registry = getContract('PlugRegistry');
      const total = Number(await registry.nextTokenId());
      const ids = Array.from({ length: total - 1 }, (_, i) => i + 1);

      const owners = await Promise.all(
        ids.map((id) => registry.ownerOf(id).catch(() => null))
      );
      const mine = ids.filter((_, i) => owners[i]?.toLowerCase() === account.toLowerCase());
      const details = await Promise.all(mine.map((id) => registry.domainOf(id)));

      setDomains(mine.map((id, i) => ({ id, ...details[i].toObject() })));
    } catch (e) {
      showError('Could not load domains', e.shortMessage || e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [account, getContract, showError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRenew = async (d) => {
    const years = Number(window.prompt(`Renew ${d.name}.${d.tld} for how many years?`, '1'));
    if (!years || years < 1 || years > 10) return;
    setBusyId(d.id);
    try {
      const registry = getContract('PlugRegistry');
      const fee = await registry.registrationFee(d.tld);
      const cost = fee * BigInt(years);
      await ensureAllowance('usdc', addresses.contracts.PlugRegistry, cost);
      const regWrite = getContract('PlugRegistry', true);
      const tx = await regWrite.renewDomain(d.id, years);
      await tx.wait();
      showSuccess('Domain renewed', `${d.name}.${d.tld} renewed for ${years} year(s)`);
      await load();
    } catch (e) {
      showError('Renew failed', e.shortMessage || e.message || String(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleTransfer = async (d) => {
    const to = window.prompt(`Transfer ${d.name}.${d.tld} to which address?`, '');
    if (!to) return;
    setBusyId(d.id);
    try {
      const registry = getContract('PlugRegistry');
      const fee = await registry.transferFee(d.tld);
      await ensureAllowance('usdc', addresses.contracts.PlugRegistry, fee);
      const regWrite = getContract('PlugRegistry', true);
      const tx = await regWrite.transferDomain(d.id, to);
      await tx.wait();
      showSuccess('Domain transferred', `${d.name}.${d.tld} → ${to}`);
      await load();
    } catch (e) {
      showError('Transfer failed', e.shortMessage || e.message || String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!account) {
    return <p className="text-sm text-[var(--text2)]">Connect your wallet to see your domains.</p>;
  }

  if (loading && !domains) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text2)]">
        <Loader2 size={14} className="animate-spin" /> Loading your domains…
      </div>
    );
  }

  if (domains && domains.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Globe size={22} className="mx-auto mb-2 text-[var(--text3)]" />
        <p className="text-sm text-[var(--text2)]">No domains yet. Register one above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {domains?.map((d) => {
        const locked = d.lockedBy !== '0x0000000000000000000000000000000000000000';
        const expired = isExpired(d.expires);
        return (
          <div key={d.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-mono text-sm text-[var(--text)]">{d.name}.{d.tld}</p>
              <p className="text-xs text-[var(--text3)] mt-0.5">
                Expires {formatDate(d.expires)} {expired && <span style={{ color: 'var(--red)' }}>(expired)</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {locked && (
                <span className="badge" style={{ background: 'rgba(212,168,67,0.12)', color: 'var(--gold)' }}>
                  <Lock size={12} /> Locked ($DPNOTE collateral)
                </span>
              )}
              <button
                onClick={() => handleRenew(d)}
                disabled={busyId === d.id}
                className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5"
              >
                <RefreshCw size={12} /> Renew
              </button>
              <button
                onClick={() => handleTransfer(d)}
                disabled={busyId === d.id || !d.transferable}
                className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5"
                title={!d.transferable ? 'Locked as loan collateral' : ''}
              >
                <Send size={12} /> Transfer
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
