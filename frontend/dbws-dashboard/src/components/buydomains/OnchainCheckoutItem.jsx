import React, { useState } from 'react';
import { Loader2, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useNotification } from '../../contexts/NotificationContext';
import { useCommitReveal } from '../../hooks/useCommitReveal';
import { recordOnchainOrder } from '../../config/backend';
import { formatUSDC } from '../../lib/format';

// Same commit-reveal state machine as the dedicated Plug Registry view
// (useCommitReveal) -- this is the unified-cart entry point to the exact
// same on-chain flow, not a second implementation of it.
export default function OnchainCheckoutItem({ item, onDone }) {
  const { account, addresses, getContract, ensureAllowance } = useWeb3();
  const { showSuccess, showError } = useNotification();
  const cr = useCommitReveal();
  const [approving, setApproving] = useState(false);

  const cost = BigInt(item.feePerYear) * BigInt(item.years || 1);

  const handleApproveAndCommit = async () => {
    setApproving(true);
    try {
      await ensureAllowance('usdc', addresses.contracts.PlugRegistry, cost);
      await cr.startCommit({ tld: item.tld, name: item.name, yearsCount: item.years || 1 });
      showSuccess('Commitment submitted', `Wait for the countdown, then reveal to register ${item.domain}.`);
    } catch (e) {
      showError('Step failed', e.shortMessage || e.message || String(e));
    } finally {
      setApproving(false);
    }
  };

  const handleReveal = async () => {
    try {
      const { txHash } = await cr.reveal();
      await recordOnchainOrder({
        domain: item.domain,
        txHash,
        walletAddress: account,
        amountUsdc6dp: Number(cost),
        idempotencyKey: `onchain:${item.domain}:${txHash}`,
      });
      showSuccess('Domain registered', item.domain);
      onDone?.();
    } catch (e) {
      showError('Reveal failed', e.shortMessage || e.message || String(e));
    }
  };

  const { step, STEP, secondsRemaining } = cr;

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text2)]">{item.domain} — {formatUSDC(cost)} total</p>

      {step === STEP.IDLE && (
        <button onClick={handleApproveAndCommit} disabled={approving} className="btn-primary w-full flex items-center justify-center gap-2">
          {approving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {approving ? 'Approving & committing…' : 'Approve USDC & Start Registration'}
        </button>
      )}
      {step === STEP.WAITING && (
        <div className="flex items-center gap-2 text-sm text-[var(--gold)]">
          <Clock size={14} /> Wait {secondsRemaining}s, then reveal (anti-front-running).
        </div>
      )}
      {step === STEP.READY && (
        <button onClick={handleReveal} className="btn-primary w-full flex items-center justify-center gap-2">
          <CheckCircle2 size={14} /> Reveal & Register
        </button>
      )}
      {step === STEP.REVEALING && (
        <div className="flex items-center gap-2 text-sm text-[var(--text2)]"><Loader2 size={14} className="animate-spin" /> Revealing…</div>
      )}
      {step === STEP.DONE && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--green)' }}><CheckCircle2 size={14} /> Registered.</div>
      )}
      {step === STEP.ERROR && (
        <button onClick={cr.reset} className="btn-secondary w-full">Reset</button>
      )}
    </div>
  );
}
