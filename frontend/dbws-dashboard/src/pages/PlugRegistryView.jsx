import React, { useState } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import ConnectPrompt from '../components/shared/ConnectPrompt';
import DomainSearchPanel from '../components/domains/DomainSearchPanel';
import MyDomainsList from '../components/domains/MyDomainsList';

export default function PlugRegistryView() {
  const { isConnected } = useWeb3();
  const [tab, setTab] = useState('search');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">Plug Registry</h2>
        <p className="text-sm text-[var(--text2)] mt-1">Register and manage .plug / .dbws domains — TLD + name registry, ERC-721, USDC-priced.</p>
      </div>

      {!isConnected ? (
        <ConnectPrompt label="Connect your wallet to search, register, and manage domains." />
      ) : (
        <>
          <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
            {[
              { id: 'search', label: 'Search & Register' },
              { id: 'mine', label: 'My Domains' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2.5 text-sm font-display font-semibold -mb-px border-b-2 transition"
                style={{
                  borderColor: tab === t.id ? 'var(--gold)' : 'transparent',
                  color: tab === t.id ? 'var(--gold)' : 'var(--text2)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'search' ? <DomainSearchPanel /> : <MyDomainsList />}
        </>
      )}
    </div>
  );
}
