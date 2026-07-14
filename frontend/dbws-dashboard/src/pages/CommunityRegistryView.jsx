import React, { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, ArrowUpCircle, Award } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';
import { useNotification } from '../contexts/NotificationContext';
import ConnectPrompt from '../components/shared/ConnectPrompt';
import { TIER_LABELS } from '../config/abis';
import { formatUSDC, formatDate } from '../lib/format';

export default function CommunityRegistryView() {
  const { account, addresses, getContract, ensureAllowance } = useWeb3();
  const { showSuccess, showError } = useNotification();

  const [tierFees, setTierFees] = useState(null);
  const [member, setMember] = useState(null); // null = not loaded, false = not a member
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joinTier, setJoinTier] = useState(0);
  const [displayName, setDisplayName] = useState('');

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const registry = getContract('CommunityRegistry');
      const fees = await Promise.all([0, 1, 2, 3].map((t) => registry.tierFees(t)));
      setTierFees(fees);

      const tokenId = await registry.walletToTokenId(account);
      if (tokenId === 0n) {
        setMember(false);
      } else {
        const m = await registry.members(tokenId);
        const ach = await registry.getAchievements(tokenId);
        setMember({ id: tokenId.toString(), ...m.toObject() });
        setAchievements(ach);
      }
    } catch (e) {
      showError('Could not load membership', e.shortMessage || e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [account, getContract, showError]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!displayName) return showError('Missing display name');
    setSubmitting(true);
    try {
      const fee = tierFees[joinTier];
      if (fee > 0n) {
        await ensureAllowance('usdc', addresses.contracts.CommunityRegistry, fee);
      }
      const registry = getContract('CommunityRegistry', true);
      const tx = await registry.joinCommunity(displayName, Number(joinTier), '');
      await tx.wait();
      showSuccess('Welcome to DBWS', `Joined as ${TIER_LABELS[joinTier]}`);
      await load();
    } catch (e) {
      showError('Join failed', e.shortMessage || e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpgrade = async () => {
    const currentTier = Number(member.tier);
    if (currentTier >= 3) return;
    const newTier = currentTier + 1;
    if (!window.confirm(`Upgrade to ${TIER_LABELS[newTier]} for ${formatUSDC(tierFees[newTier] - tierFees[currentTier])}?`)) return;
    try {
      const diff = tierFees[newTier] - tierFees[currentTier];
      if (diff > 0n) {
        await ensureAllowance('usdc', addresses.contracts.CommunityRegistry, diff);
      }
      const registry = getContract('CommunityRegistry', true);
      const tx = await registry.upgradeTier(newTier);
      await tx.wait();
      showSuccess('Tier upgraded', TIER_LABELS[newTier]);
      await load();
    } catch (e) {
      showError('Upgrade failed', e.shortMessage || e.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">Community Registry</h2>
        <p className="text-sm text-[var(--text2)] mt-1">On-chain identity for every DBWS member — four tiers, reputation, and voting weight.</p>
      </div>

      {!account ? (
        <ConnectPrompt label="Connect your wallet to join or view your membership." />
      ) : loading && member === null ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text2)]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : member ? (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-display font-bold text-lg text-[var(--text)]">{member.displayName}</p>
              <span className="badge mt-1" style={{ background: 'rgba(212,168,67,0.12)', color: 'var(--gold)' }}>
                {TIER_LABELS[Number(member.tier)]} {member.soulbound && '· Soulbound'}
              </span>
            </div>
            {Number(member.tier) < 3 && (
              <button onClick={handleUpgrade} className="btn-primary flex items-center gap-2">
                <ArrowUpCircle size={14} /> Upgrade to {TIER_LABELS[Number(member.tier) + 1]}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Reputation" value={member.reputationScore.toString()} />
            <Stat label="Contribution" value={member.contributionScore.toString()} />
            <Stat label="Voting Power" value={member.votingPower.toString()} />
            <Stat label="Joined" value={formatDate(member.joinDate)} />
          </div>
          {achievements.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text3)] mb-2 flex items-center gap-1"><Award size={12} /> Achievements</p>
              <div className="flex flex-wrap gap-2">
                {achievements.map((a, i) => <span key={i} className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{a}</span>)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleJoin} className="card p-5 space-y-3">
          <h3 className="font-display font-bold text-sm text-[var(--text)] flex items-center gap-2"><Users size={16} /> Join the Community</h3>
          <input className="input" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TIER_LABELS.map((label, i) => (
              <button
                type="button"
                key={label}
                onClick={() => setJoinTier(i)}
                className="p-3 rounded-lg text-left border transition"
                style={{
                  borderColor: joinTier === i ? 'var(--gold)' : 'var(--border)',
                  background: joinTier === i ? 'rgba(212,168,67,0.08)' : 'var(--surface2)',
                }}
              >
                <p className="text-xs font-display font-semibold text-[var(--text)]">{label}</p>
                <p className="text-xs text-[var(--gold)] mt-1 font-mono">{tierFees ? formatUSDC(tierFees[i]) : '…'}</p>
              </button>
            ))}
          </div>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            {submitting ? 'Joining…' : `Join as ${TIER_LABELS[joinTier]}`}
          </button>
        </form>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--surface2)' }}>
      <p className="text-xs text-[var(--text3)]">{label}</p>
      <p className="font-mono text-sm text-[var(--text)] mt-0.5">{value}</p>
    </div>
  );
}
