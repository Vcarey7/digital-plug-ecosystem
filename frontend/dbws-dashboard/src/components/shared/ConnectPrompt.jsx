import React from 'react';
import { Wallet } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';

// Shown in place of a view's content when no wallet is connected yet.
export default function ConnectPrompt({ label = 'Connect your wallet to continue' }) {
  const { connectWallet, isConnecting } = useWeb3();
  return (
    <div className="card p-10 flex flex-col items-center text-center gap-3">
      <Wallet size={28} className="text-[var(--gold)]" />
      <p className="text-sm text-[var(--text2)]">{label}</p>
      <button onClick={connectWallet} disabled={isConnecting} className="btn-primary mt-1">
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
    </div>
  );
}
