import React, { useState, useEffect, useMemo } from 'react';
import { Search, CheckCircle2, XCircle, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useNotification } from '../../contexts/NotificationContext';
import { useCommitReveal } from '../../hooks/useCommitReveal';
import { loadTldManifest } from '../../config/network';
import { formatUSDC } from '../../lib/format';

const FALLBACK_TLDS = ['plug', 'dbws', 'sovereign', 'wall', 'black'];

export default function DomainSearchPanel() {
  const { account, addresses, getContract, ensureAllowance } = useWeb3();
  const { showSuccess, showError, showInfo } = useNotification();
  const cr = useCommitReveal();

  const [tldOptions, setTldOptions] = useState(null); // [{tld, tier, enabled}] | null (not synced)
  const [name, setName] = useState('');
  const [tld, setTld] = useState('');
  const [years, setYears] = useState(1);

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null); // { available, enabled, feePerYear } | null
  const [checkError, setCheckError] = useState(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    loadTldManifest().then((m) => {
      if (m?.tlds?.length) {
        setTldOptions(m.tlds);
        const firstEnabled = m.tlds.find((t) => t.enabled);
        if (firstEnabled) setTld(firstEnabled.tld);
      } else {
        setTld(FALLBACK_TLDS[0]);
      }
    });
  }, []);

  const cost = useMemo(() => {
    if (!availability?.feePerYear) return null;
    return availability.feePerYear * BigInt(years || 1);
  }, [availability, years]);

  const cleanName = name.trim().toLowerCase();
  const cleanTld = tld.trim().toLowerCase();

  const checkAvailability = async () => {
    if (!cleanName || !cleanTld) return;
    setChecking(true);
    setCheckError(null);
    setAvailability(null);
    cr.reset();
    try {
      const registry = getContract('PlugRegistry');
      const [available, enabled, feePerYear] = await Promise.all([
        registry.isAvailable(cleanTld, cleanName),
        registry.tldEnabled(cleanTld),
        registry.registrationFee(cleanTld),
      ]);
      setAvailability({ available, enabled, feePerYear });
    } catch (e) {
      setCheckError(e.shortMessage || e.message || String(e));
    } finally {
      setChecking(false);
    }
  };

  const canRegister = availability?.available && availability?.enabled && cost != null;

  const handleApproveAndCommit = async () => {
    if (!account) return showError('Wallet not connected');
    setApproving(true);
    try {
      await ensureAllowance('usdc', addresses.contracts.PlugRegistry, cost);
      showInfo('USDC approved', 'Submitting commitment on-chain…');
      await cr.startCommit({ tld: cleanTld, name: cleanName, yearsCount: years });
      showSuccess('Commitment submitted', `Wait for the countdown, then reveal to register ${cleanName}.${cleanTld}`);
    } catch (e) {
      showError('Registration step failed', e.shortMessage || e.message || String(e));
    } finally {
      setApproving(false);
    }
  };

  const handleReveal = async () => {
    try {
      const { tokenId } = await cr.reveal();
      showSuccess('Domain registered!', `${cleanName}.${cleanTld} — token #${tokenId}`);
      setAvailability((a) => (a ? { ...a, available: false } : a));
    } catch (e) {
      showError('Reveal failed', e.shortMessage || e.message || String(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-display font-bold text-sm mb-4 text-[var(--text)]">Search &amp; Register</h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_120px_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-[var(--text3)] block mb-1">Name</label>
            <input
              className="input"
              placeholder="vance"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="text-[var(--text3)] pb-2.5 hidden sm:block">.</div>
          <div>
            <label className="text-xs text-[var(--text3)] block mb-1">TLD</label>
            {tldOptions ? (
              <select className="input" value={tld} onChange={(e) => setTld(e.target.value)}>
                {tldOptions.map((t) => (
                  <option key={t.tld} value={t.tld} disabled={!t.enabled}>
                    .{t.tld} {t.enabled ? '' : '(reserved)'}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input" placeholder="plug" value={tld} onChange={(e) => setTld(e.target.value)} />
            )}
          </div>
          <button
            onClick={checkAvailability}
            disabled={!cleanName || !cleanTld || checking}
            className="btn-primary flex items-center gap-2 justify-center"
          >
            {checking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Check
          </button>
        </div>

        {checkError && (
          <p className="text-xs mt-3" style={{ color: 'var(--red)' }}>{checkError}</p>
        )}

        {availability && (
          <div className="mt-4 p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--surface2)' }}>
            <div className="flex items-center gap-2">
              {availability.available && availability.enabled ? (
                <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
              ) : (
                <XCircle size={16} style={{ color: 'var(--red)' }} />
              )}
              <span className="text-sm font-mono">{cleanName}.{cleanTld}</span>
              <span className="text-xs text-[var(--text3)]">
                {!availability.enabled ? '— TLD not enabled for registration' : availability.available ? '— available' : '— taken'}
              </span>
            </div>
            {availability.enabled && (
              <span className="text-xs text-[var(--gold)] font-mono">{formatUSDC(availability.feePerYear)}/yr</span>
            )}
          </div>
        )}

        {canRegister && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs text-[var(--text3)]">Years</label>
              <input
                type="number"
                min={1}
                max={10}
                className="input w-20"
                value={years}
                onChange={(e) => setYears(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              />
              <span className="text-sm font-mono text-[var(--gold)] ml-auto">Total: {formatUSDC(cost)}</span>
            </div>

            <RegisterWizard
              cr={cr}
              account={account}
              approving={approving}
              onApproveAndCommit={handleApproveAndCommit}
              onReveal={handleReveal}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RegisterWizard({ cr, account, approving, onApproveAndCommit, onReveal }) {
  const { step, STEP, error, secondsRemaining } = cr;

  if (!account) {
    return <p className="text-xs text-[var(--text2)]">Connect your wallet to register this domain.</p>;
  }

  if (step === STEP.IDLE) {
    return (
      <button onClick={onApproveAndCommit} disabled={approving} className="btn-primary w-full flex items-center justify-center gap-2">
        {approving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
        {approving ? 'Approving USDC & committing…' : 'Approve USDC & Start Registration'}
      </button>
    );
  }

  if (step === STEP.COMMITTING) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text2)]">
        <Loader2 size={14} className="animate-spin" /> Submitting commitment…
      </div>
    );
  }

  if (step === STEP.WAITING) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-[var(--gold)]">
          <Clock size={14} /> Commitment locked in — wait {secondsRemaining}s before revealing (anti-front-running).
        </div>
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          Do not refresh this page — the registration secret lives in memory only and will be lost.
        </p>
      </div>
    );
  }

  if (step === STEP.READY) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-[var(--text2)]">Ready to reveal and complete registration.</p>
        <button onClick={onReveal} className="btn-primary w-full flex items-center justify-center gap-2">
          <CheckCircle2 size={14} /> Reveal &amp; Register
        </button>
      </div>
    );
  }

  if (step === STEP.REVEALING) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text2)]">
        <Loader2 size={14} className="animate-spin" /> Revealing &amp; minting…
      </div>
    );
  }

  if (step === STEP.DONE) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--green)' }}>
        <CheckCircle2 size={14} /> Registered! Check "My Domains" below.
      </div>
    );
  }

  if (step === STEP.EXPIRED) {
    return (
      <div className="space-y-2">
        <p className="text-xs" style={{ color: 'var(--red)' }}>Commitment expired before reveal. Start over.</p>
        <button onClick={cr.reset} className="btn-secondary">Reset</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs" style={{ color: 'var(--red)' }}>{error || 'Something went wrong.'}</p>
      <button onClick={cr.reset} className="btn-secondary">Reset</button>
    </div>
  );
}
