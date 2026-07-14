import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useWeb3 } from '../../contexts/Web3Context';

export default function Layout() {
  const { addressesError } = useWeb3();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-6 py-6 max-w-6xl">
          {addressesError ? (
            <div className="card p-4 border" style={{ borderColor: 'var(--red)' }}>
              <p className="font-display font-semibold text-sm text-[var(--red)]">Could not load deployment addresses</p>
              <p className="text-xs text-[var(--text2)] mt-1 font-mono">{addressesError}</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
