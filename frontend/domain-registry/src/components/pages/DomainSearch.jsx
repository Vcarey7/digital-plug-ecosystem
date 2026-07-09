import React, { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { Search, CheckCircle2, XCircle, Loader2, Clock, Globe } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useNotification } from '../../contexts/NotificationContext';
import { SUPPORTED_TLDS } from '../../config/contracts';
import {
  savePendingCommitment,
  getPendingCommitment,
  clearPendingCommitment,
} from '../../lib/pendingCommitments';

const DURATIONS = [
  { label: '1 year', seconds: 365 * 24 * 60 * 60 },
  { label: '2 years', seconds: 2 * 365 * 24 * 60 * 60 },
  { label: '5 years', seconds: 5 * 365 * 24 * 60 * 60 },
];

const LABEL_PATTERN = /^[a-z0-9-]{1,63}$/;

const DomainSearch = () => {
  const { account, connectWallet, getContract, isContractConfigured } = useWeb3();
  const { showSuccess, showError, showInfo } = useNotification();

  const [label, setLabel] = useState('');
  const [tld, setTld] = useState(SUPPORTED_TLDS[0]);
  const [duration, setDuration] = useState(DURATIONS[0].seconds);
  const [status, setStatus] = useState('idle'); // idle | invalid | checking | available | taken
  const [price, setPrice] = useState(null);
  const [pending, setPending] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const cleanLabel = label.trim().toLowerCase();
  const fullName = cleanLabel ? `${cleanLabel}${tld}` : '';
  const labelValid = cleanLabel.length === 0 || LABEL_PATTERN.test(cleanLabel);
  const registryConfigured = isContractConfigured('domainRegistry');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setPending(cleanLabel ? getPendingCommitment(fullName) : null);

    if (!cleanLabel) {
      setStatus('idle');
      setPrice(null);
      return;
    }
    if (!labelValid) {
      setStatus('invalid');
      setPrice(null);
      return;
    }
    if (!registryConfigured) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('checking');
    (async () => {
      try {
        const registry = getContract('domainRegistry');
        const tldName = tld.slice(1); // registry stores TLDs without the dot
        const tldHash = await registry.namehash(tldName);
        const isTldRegistered = await registry.registeredTLDs(tldHash);
        if (!isTldRegistered) {
          if (!cancelled) {
            setStatus('idle');
            showError('TLD not available', `${tld} hasn't been registered on this deployment yet.`);
          }
          return;
        }

        const domainHash = await registry.namehash(fullName);
        const exists = await registry.domainExists(domainHash);
        if (cancelled) return;

        setStatus(exists ? 'taken' : 'available');
        if (!exists) {
          const basePrice = await registry.baseDomainPrice();
          if (!cancelled) setPrice(basePrice);
        } else {
          setPrice(null);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('idle');
          showError('Lookup failed', error.reason || error.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanLabel, tld, registryConfigured]);

  const minAgeMs = 60 * 1000; // matches DomainRegistry's default minCommitmentAge
  const canReveal = pending && now - pending.committedAt >= minAgeMs;
  const revealCountdownSec = pending ? Math.max(0, Math.ceil((minAgeMs - (now - pending.committedAt)) / 1000)) : 0;

  async function handleCommit() {
    if (!account) {
      await connectWallet();
      return;
    }
    setBusy(true);
    try {
      const registry = getContract('domainRegistry', true);
      const tldName = tld.slice(1);
      const secret = ethers.hexlify(ethers.randomBytes(32));
      const commitment = await registry.makeDomainCommitment(tldName, cleanLabel, account, secret);
      const tx = await registry.commit(commitment);
      await tx.wait();

      const record = { owner: account, secret, committedAt: Date.now() };
      savePendingCommitment(fullName, record);
      setPending(record);
      showInfo('Commitment submitted', 'Wait about a minute, then complete registration to reveal it.');
    } catch (error) {
      showError('Commit failed', error.reason || error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setBusy(true);
    try {
      const registry = getContract('domainRegistry', true);
      const tldName = tld.slice(1);
      const cost = await registry.baseDomainPrice();
      const tx = await registry.registerDomain(
        tldName,
        cleanLabel,
        duration,
        ethers.ZeroAddress,
        '',
        pending.secret,
        { value: cost }
      );
      await tx.wait();

      clearPendingCommitment(fullName);
      setPending(null);
      setStatus('taken');
      showSuccess('Domain registered', `${fullName} is now yours.`);
    } catch (error) {
      showError('Registration failed', error.reason || error.shortMessage || error.message);
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = useMemo(() => {
    if (!cleanLabel) return null;
    if (status === 'invalid') return { icon: XCircle, text: 'Use lowercase letters, numbers, or hyphens only.', color: 'text-red-400' };
    if (status === 'checking') return { icon: Loader2, text: 'Checking availability...', color: 'text-muted-foreground', spin: true };
    if (status === 'available') return { icon: CheckCircle2, text: 'Available', color: 'text-green-400' };
    if (status === 'taken') return { icon: XCircle, text: 'Already registered', color: 'text-red-400' };
    return null;
  }, [status, cleanLabel]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold gold-gradient">Domain Search</h1>
        <p className="text-muted-foreground">Find and register a .plug or .dbws domain.</p>
      </div>

      {!registryConfigured && (
        <div className="luxury-card p-4 text-sm text-yellow-400">
          DomainRegistry address isn't configured. Set VITE_DOMAIN_REGISTRY_ADDRESS in .env after deploying the
          contracts.
        </div>
      )}

      <div className="luxury-card p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value.toLowerCase())}
              placeholder="yourname"
              className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
            />
          </div>
          <select
            value={tld}
            onChange={(e) => setTld(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 font-mono"
          >
            {SUPPORTED_TLDS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {statusBadge && (
          <div className={`flex items-center gap-2 mt-4 text-sm ${statusBadge.color}`}>
            <statusBadge.icon className={statusBadge.spin ? 'animate-spin' : ''} size={16} />
            {statusBadge.text}
          </div>
        )}

        {status === 'available' && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                <span className="font-mono font-medium">{fullName}</span>
              </div>
              <div className="flex gap-1 bg-secondary rounded-lg p-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d.seconds}
                    onClick={() => setDuration(d.seconds)}
                    className={`px-2.5 py-1 text-xs rounded-md ${
                      duration === d.seconds ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {price !== null && (
              <p className="text-sm text-muted-foreground mb-4">
                Price: <span className="text-foreground font-medium">{ethers.formatEther(price)} MATIC</span>
              </p>
            )}

            {!pending ? (
              <button onClick={handleCommit} disabled={busy} className="luxury-button w-full">
                {busy ? 'Submitting commitment...' : account ? '1. Commit to register' : 'Connect wallet to register'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock size={16} />
                  {canReveal
                    ? 'Ready to complete registration'
                    : `Wait ${revealCountdownSec}s before completing (anti front-running delay)`}
                </div>
                <button onClick={handleRegister} disabled={busy || !canReveal} className="luxury-button w-full">
                  {busy ? 'Registering...' : '2. Complete registration'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainSearch;
