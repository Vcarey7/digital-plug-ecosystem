import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Building2, Copyright, Landmark, Users, FileText, Loader2, ArrowRight } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';
import ConnectPrompt from '../components/shared/ConnectPrompt';
import { TIER_LABELS } from '../config/abis';

const CARDS = [
  { key: 'domains', to: '/domains', label: 'Domains', icon: Globe },
  { key: 'entities', to: '/entities', label: 'Entities', icon: Building2 },
  { key: 'ip', to: '/ip', label: 'IP Assets', icon: Copyright },
  { key: 'licenses', to: '/licenses', label: 'Licenses', icon: Landmark },
  { key: 'community', to: '/community', label: 'Community', icon: Users },
  { key: 'notes', to: '/notes', label: '$DPNOTE (notes)', icon: FileText },
];

export default function PortfolioHome() {
  const { account, addresses, getContract } = useWeb3();
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!account || !addresses) return;
    setLoading(true);
    try {
      const [domainsBal, entities, ip, licenses, communityTokenId, notes] = await Promise.all([
        getContract('PlugRegistry').balanceOf(account),
        getContract('EntityRegistry').getOwnerEntities(account),
        getContract('IPRegistry').getOwnerIP(account),
        getContract('LicenseRegistry').getOperatorLicenses(account),
        getContract('CommunityRegistry').walletToTokenId(account),
        addresses.contracts?.NoteRegistry
          ? getContract('NoteRegistry').getBorrowerNotes(account)
          : Promise.resolve([]),
      ]);

      let communityTier = null;
      if (communityTokenId !== 0n) {
        const m = await getContract('CommunityRegistry').members(communityTokenId);
        communityTier = Number(m.tier);
      }

      setCounts({
        domains: Number(domainsBal),
        entities: entities.length,
        ip: ip.length,
        licenses: licenses.length,
        community: communityTokenId !== 0n ? 1 : 0,
        communityTier,
        notes: notes.length,
      });
    } finally {
      setLoading(false);
    }
  }, [account, addresses, getContract]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">Portfolio</h2>
        <p className="text-sm text-[var(--text2)] mt-1">Everything registered to your wallet across the DBWS Registry Suite.</p>
      </div>

      {!account ? (
        <ConnectPrompt label="Connect your wallet to see your DBWS portfolio." />
      ) : loading && !counts ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text2)]"><Loader2 size={14} className="animate-spin" /> Loading your portfolio…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map(({ key, to, label, icon: Icon }) => (
            <Link key={key} to={to} className="card p-5 flex flex-col gap-3 hover:border-[var(--gold)] transition" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <Icon size={20} className="text-[var(--gold)]" />
                <ArrowRight size={14} className="text-[var(--text3)]" />
              </div>
              <div>
                <p className="text-2xl font-display font-extrabold text-[var(--text)]">{counts?.[key] ?? '—'}</p>
                <p className="text-xs text-[var(--text2)] mt-0.5">
                  {label}
                  {key === 'community' && counts?.communityTier != null && ` · ${TIER_LABELS[counts.communityTier]}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
