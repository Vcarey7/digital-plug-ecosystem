import React from 'react';
import { Wallet, AlertTriangle } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';

export default function Header() {
  const {
    isConnected, isConnecting, account, connectWallet, disconnectWallet,
    formatAddress, isCorrectNetwork, switchNetwork, targetNetwork, chainId,
  } = useWeb3();

  return (
    <header className="border-b sticky top-0 z-40 backdrop-blur" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,10,0.85)' }}>
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="font-display font-extrabold text-lg tracking-tight text-[var(--text)]">DBWS Registry Dashboard</h1>
          <p className="text-xs text-[var(--text3)]">Digital Black Wall Street · Digital Plug Co.</p>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && !isCorrectNetwork() && (
            <button onClick={switchNetwork} className="badge" style={{ background: 'rgba(231,76,60,0.12)', color: 'var(--red)' }}>
              <AlertTriangle size={14} />
              Wrong network ({chainId}) — switch to {targetNetwork.chainName}
            </button>
          )}

          {isConnected ? (
            <button onClick={disconnectWallet} className="btn-secondary flex items-center gap-2">
              <Wallet size={14} />
              {formatAddress(account)}
            </button>
          ) : (
            <button onClick={connectWallet} disabled={isConnecting} className="btn-primary flex items-center gap-2">
              <Wallet size={14} />
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
