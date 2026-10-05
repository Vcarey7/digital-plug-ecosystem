import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Loader2, Link2, PlusCircle } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';
import { useNotification } from '../contexts/NotificationContext';
import ConnectPrompt from '../components/shared/ConnectPrompt';
import { formatUSDC, formatDate } from '../lib/format';

const ENTITY_TYPES = ['LLC', 'Corporation', 'DAO', 'Nonprofit', 'Sole Proprietorship', 'Partnership'];

export default function EntityRegistryView() {
  const { account, addresses, getContract, ensureAllowance } = useWeb3();
  const { showSuccess, showError } = useNotification();

  const [fee, setFee] = useState(null);
  const [entities, setEntities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    entityName: '', entityType: ENTITY_TYPES[0], stateOfFormation: '',
    einHash: '', formationDate: '', metadataURI: '',
  });

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const registry = getContract('EntityRegistry');
      const [f, ids] = await Promise.all([registry.registrationFee(), registry.getOwnerEntities(account)]);
      setFee(f);
      const details = await Promise.all(ids.map((id) => registry.entities(id)));
      setEntities(ids.map((id, i) => ({ id: id.toString(), ...details[i].toObject() })));
    } catch (e) {
      showError('Could not load entities', e.shortMessage || e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [account, getContract, showError]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.entityName || !form.stateOfFormation || !form.einHash || !form.formationDate) {
      return showError('Missing fields', 'Fill in entity name, state, EIN hash, and formation date.');
    }
    setSubmitting(true);
    try {
      const registryRead = getContract('EntityRegistry');
      const currentFee = fee ?? (await registryRead.registrationFee());
      await ensureAllowance('usdc', addresses.contracts.EntityRegistry, currentFee);
      const registry = getContract('EntityRegistry', true);
      const tx = await registry.registerEntity(
        form.entityName,
        form.entityType,
        form.stateOfFormation,
        form.einHash,
        Math.floor(new Date(form.formationDate).getTime() / 1000),
        form.metadataURI
      );
      await tx.wait();
      showSuccess('Entity registered', form.entityName);
      setForm({ entityName: '', entityType: ENTITY_TYPES[0], stateOfFormation: '', einHash: '', formationDate: '', metadataURI: '' });
      await load();
    } catch (e) {
      showError('Registration failed', e.shortMessage || e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkDomain = async (id) => {
    const domain = window.prompt('Domain to link (e.g. vance.plug)?');
    if (!domain) return;
    try {
      const registry = getContract('EntityRegistry', true);
      const tx = await registry.linkDomain(id, domain);
      await tx.wait();
      showSuccess('Domain linked', domain);
      await load();
    } catch (e) {
      showError('Link failed', e.shortMessage || e.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">Entity Registry</h2>
        <p className="text-sm text-[var(--text2)] mt-1">Business entity / LLC catalog. Registration fee: {fee ? formatUSDC(fee) : '—'}.</p>
      </div>

      {!account ? (
        <ConnectPrompt label="Connect your wallet to register and manage entities." />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm text-[var(--text)]">Register New Entity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="input" placeholder="Entity name" value={form.entityName} onChange={(e) => setForm({ ...form, entityName: e.target.value })} />
              <select className="input" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
                {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="input" placeholder="State of formation" value={form.stateOfFormation} onChange={(e) => setForm({ ...form, stateOfFormation: e.target.value })} />
              <input className="input" placeholder="EIN hash (pre-hashed off-chain)" value={form.einHash} onChange={(e) => setForm({ ...form, einHash: e.target.value })} />
              <input type="date" className="input" value={form.formationDate} onChange={(e) => setForm({ ...form, formationDate: e.target.value })} />
              <input className="input" placeholder="Metadata URI (ipfs://…, optional)" value={form.metadataURI} onChange={(e) => setForm({ ...form, metadataURI: e.target.value })} />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              {submitting ? 'Registering…' : `Register Entity (${fee ? formatUSDC(fee) : '…'})`}
            </button>
          </form>

          <div>
            <h3 className="font-display font-bold text-sm mb-3 text-[var(--text)]">My Entities</h3>
            {loading && !entities ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text2)]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : entities && entities.length === 0 ? (
              <div className="card p-8 text-center">
                <Building2 size={22} className="mx-auto mb-2 text-[var(--text3)]" />
                <p className="text-sm text-[var(--text2)]">No entities registered yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entities?.map((ent) => (
                  <div key={ent.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-display font-semibold text-sm text-[var(--text)]">{ent.entityName}</p>
                      <p className="text-xs text-[var(--text3)] mt-0.5">{ent.entityType} · {ent.stateOfFormation} · formed {formatDate(ent.formationDate)}</p>
                    </div>
                    <button onClick={() => handleLinkDomain(ent.id)} className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5">
                      <Link2 size={12} /> Link Domain
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
