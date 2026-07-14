import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, ShieldAlert } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';
import { useNotification } from '../contexts/NotificationContext';
import ConnectPrompt from '../components/shared/ConnectPrompt';
import { NOTE_TYPE_LABELS, NOTE_STATUS_LABELS } from '../config/abis';
import { formatUSDC, formatDate } from '../lib/format';

// $DPNOTE is a private-credit ledger under a legal hold: origination is
// treasury (owner)-only on-chain, and scripts/deploy.js skips deploying it
// to mainnet entirely unless NOTE_REGISTRY_LEGAL_CLEARANCE is set after
// attorney sign-off. This view is read-only by design -- there is no
// origination UI here, matching that hold.
export default function NoteRegistryView() {
  const { account, addresses, getContract } = useWeb3();
  const { showError } = useNotification();

  const [notFound, setNotFound] = useState(false);
  const [health, setHealth] = useState(null);
  const [myNotes, setMyNotes] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!addresses) return;
    if (!addresses.contracts?.NoteRegistry) {
      setNotFound(true);
      return;
    }
    setLoading(true);
    try {
      const registry = getContract('NoteRegistry');
      const h = await registry.getPortfolioHealth();
      setHealth(h);
      if (account) {
        const ids = await registry.getBorrowerNotes(account);
        const details = await Promise.all(ids.map((id) => registry.notes(id)));
        setMyNotes(ids.map((id, i) => ({ id: id.toString(), ...details[i].toObject() })));
      }
    } catch (e) {
      showError('Could not load $DPNOTE data', e.shortMessage || e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [account, addresses, getContract, showError]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">$DPNOTE — Note Registry</h2>
        <p className="text-sm text-[var(--text2)] mt-1">Private-credit portfolio ledger. Read-only here — notes are originated by the treasury only.</p>
      </div>

      <div className="card p-3 flex items-start gap-2" style={{ borderColor: 'var(--gold)' }}>
        <ShieldAlert size={16} className="text-[var(--gold)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--text2)]">
          $DPNOTE is under an active legal hold pending securities review and is not deployed to mainnet.
          This view only reads existing on-chain state — it has no origination controls.
        </p>
      </div>

      {notFound ? (
        <div className="card p-8 text-center">
          <FileText size={22} className="mx-auto mb-2 text-[var(--text3)]" />
          <p className="text-sm text-[var(--text2)]">NoteRegistry is not deployed on this network (expected — it's mainnet-gated pending legal clearance).</p>
        </div>
      ) : loading && !health ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text2)]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : (
        <>
          {health && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Portfolio Value" value={formatUSDC(health.totalValue)} />
              <Stat label="Originated" value={health.originated.toString()} />
              <Stat label="Repaid" value={health.repaid.toString()} />
              <Stat label="Defaulted" value={health.defaulted.toString()} />
            </div>
          )}

          {!account ? (
            <ConnectPrompt label="Connect your wallet to view notes where you're the borrower." />
          ) : (
            <div>
              <h3 className="font-display font-bold text-sm mb-3 text-[var(--text)]">My Notes (as borrower)</h3>
              {myNotes && myNotes.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-sm text-[var(--text2)]">No notes originated against your address.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myNotes?.map((n) => (
                    <div key={n.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="font-mono text-sm text-[var(--text)]">Note #{n.id} — {formatUSDC(n.principal)}</p>
                        <p className="text-xs text-[var(--text3)] mt-0.5">
                          {NOTE_TYPE_LABELS[Number(n.noteType)]} · {(Number(n.interestRate) / 100).toFixed(2)}% APR · matures {formatDate(n.maturityDate)}
                        </p>
                      </div>
                      <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                        {NOTE_STATUS_LABELS[Number(n.status)]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-lg card">
      <p className="text-xs text-[var(--text3)]">{label}</p>
      <p className="font-mono text-sm text-[var(--text)] mt-0.5">{value}</p>
    </div>
  );
}
