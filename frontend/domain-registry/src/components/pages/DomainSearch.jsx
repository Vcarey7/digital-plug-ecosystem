import React, { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { Search, CheckCircle2, XCircle, Loader2, Clock, Globe } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useNotification } from '../../contexts/NotificationContext';
import { SUPPORTED_TLDS, PLUG_REGISTRAR_ADDRESS } from '../../config/contracts';
import {
  savePendingCommitment,
  getPendingCommitment,
  clearPendingCommitment,
} from '../../lib/pendingCommitments';

const DURATIONS = [
  { label: '1 year', years: 1 },
  { label: '2 years', years: 2 },
  { label: '5 years', years: 5 },
];

const LABEL_PATTERN = /^[a-z0-9-]{1,63}$/;

const DomainSearch = () => {
  const { account, connectWallet, getContract, isContractConfigured, ensureAllowance } = useWeb3();
  const { showSuccess, showError, showInfo } = useNotification();

  const [label, setLabel] = useState('');
  const [tld, setTld] = useState(SUPPORTED_TLDS[0]);
  const [years, setYears] = useState(DURATIONS[0].years);
  const [payInPlug, setPayInPlug] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | invalid | checking | available | taken | disabled
  const [price, setPrice] = useState(null);
  const [pending, setPending] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [minCommitmentAgeMs, setMinCommitmentAgeMs] = useState(60 * 1000);

  const cleanLabel = label.trim().toLowerCase();
  const tldName = tld.slice(1); // registry stores TLDs without the dot
  const fullName = cleanLabel ? `${cleanLabel}${tld}` : '';
  const labelValid = cleanLabel.length === 0 || LABEL_PATTERN.test(cleanLabel);
  const registryConfigured = isContractConfigured('plugRegistry') && isContractConfigured('plugRegistrar');
  const payToken = payInPlug ? 'plugToken' : 'usdc';
  const payTokenLabel = payInPlug ? '$PLUG' : 'USDC';

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
        const registrar = getContract('plugRegistrar');
        const cfg = await registrar.tldConfig(tldName);
        if (!cfg.enabled) {
          if (!cancelled) {
            setStatus('disabled');
            showError('TLD not available', `${tld} hasn't been enabled for registration on this deployment yet.`);
          }
          return;
        }

        const registry = getContract('plugRegistry');
        const available = await registry.isAvailable(cleanLabel, tldName);
        if (cancelled) return;

        setStatus(available ? 'available' : 'taken');
        if (available) {
          const cost = await registrar.quote(cleanLabel, tldName, years, payInPlug);
          if (!cancelled) setPrice(cost);
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
  }, [cleanLabel, tld, years, payInPlug, registryConfigured]);

  // Read the registrar's actual commit-reveal window instead of assuming.
  useEffect(() => {
    if (!registryConfigured) return;
    (async () => {
      try {
        const registrar = getContract('plugRegistrar');
        const minAge = await registrar.minCommitmentAge();
        setMinCommitmentAgeMs(Number(minAge) * 1000);
      } catch {
        // keep the 60s default if this fails (e.g. address not deployed yet)
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryConfigured]);

  const canReveal = pending && now - pending.committedAt >= minCommitmentAgeMs;
  const revealCountdownSec = pending
    ? Math.max(0, Math.ceil((minCommitmentAgeMs - (now - pending.committedAt)) / 1000))
    : 0;

  async function handleCommit() {
    if (!account) {
      await connectWallet();
      return;
    }
    setBusy(true);
    try {
      const registrar = getContract('plugRegistrar', true);
      const secret = ethers.hexlify(ethers.randomBytes(32));
      const commitment = await registrar.makeCommitment(cleanLabel, tldName, account, secret);
      const tx = await registrar.commit(commitment);
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
      const registrar = getContract('plugRegistrar', true);
      const cost = await registrar.quote(cleanLabel, tldName, years, payInPlug);

      showInfo('Approving payment', `Approving ${payTokenLabel} for the registrar...`);
      await ensureAllowance(payToken, PLUG_REGISTRAR_ADDRESS, cost);

      const tx = await registrar.registerDomain(
        cleanLabel,
        tldName,
        pending.secret,
        years,
        payInPlug,
        ethers.ZeroAddress
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
    if (status === 'disabled') return { icon: XCircle, text: `${tld} isn't enabled for registration yet.`, color: 'text-red-400' };
    return null;
  }, [status, cleanLabel, tld]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold gold-gradient">Domain Search</h1>
        <p className="text-muted-foreground">Find and register a .plug or .dbws domain, paid in USDC or $PLUG.</p>
      </div>

      {!registryConfigured && (
        <div className="luxury-card p-4 text-sm text-yellow-400">
          PlugRegistry/PlugRegistrar aren't configured. Set VITE_PLUG_REGISTRY_ADDRESS and
          VITE_PLUG_REGISTRAR_ADDRESS in .env after deploying contracts/dbws-suite.
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
                    key={d.years}
                    onClick={() => setYears(d.years)}
                    className={`px-2.5 py-1 text-xs rounded-md ${
                      years === d.years ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Pay with</span>
              <div className="flex gap-1 bg-secondary rounded-lg p-1">
                {[
                  { label: 'USDC', value: false },
                  { label: '$PLUG (discounted)', value: true },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setPayInPlug(opt.value)}
                    className={`px-2.5 py-1 text-xs rounded-md ${
                      payInPlug === opt.value ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {price !== null && (
              <p className="text-sm text-muted-foreground mb-4">
                Price:{' '}
                <span className="text-foreground font-medium">
                  {ethers.formatUnits(price, payInPlug ? 18 : 6)} {payTokenLabel}
                </span>
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
                  {busy ? 'Registering...' : `2. Approve ${payTokenLabel} & complete registration`}
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
