import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Copyright, Loader2, PlusCircle, FileSignature } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';
import { useNotification } from '../contexts/NotificationContext';
import ConnectPrompt from '../components/shared/ConnectPrompt';
import { IP_TYPE_LABELS } from '../config/abis';
import { formatUSDC, formatDate } from '../lib/format';

export default function IPRegistryView() {
  const { account, addresses, getContract, ensureAllowance } = useWeb3();
  const { showSuccess, showError } = useNotification();

  const [fee, setFee] = useState(null);
  const [assets, setAssets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '', ipType: 0, descriptionHash: '', contentIdentifier: '',
    creationDate: '', metadataURI: '',
  });

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const registry = getContract('IPRegistry');
      const [f, ids] = await Promise.all([registry.registrationFee(), registry.getOwnerIP(account)]);
      setFee(f);
      const details = await Promise.all(ids.map((id) => registry.ipAssets(id)));
      setAssets(ids.map((id, i) => ({ id: id.toString(), ...details[i].toObject() })));
    } catch (e) {
      showError('Could not load IP assets', e.shortMessage || e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [account, getContract, showError]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.contentIdentifier || !form.creationDate) {
      return showError('Missing fields', 'Fill in title, content identifier, and creation date.');
    }
    setSubmitting(true);
    try {
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(form.contentIdentifier));
      const registryRead = getContract('IPRegistry');
      const currentFee = fee ?? (await registryRead.registrationFee());
      await ensureAllowance('usdc', addresses.contracts.IPRegistry, currentFee);
      const registry = getContract('IPRegistry', true);
      const tx = await registry.registerIP(
        form.title,
        Number(form.ipType),
        form.descriptionHash,
        contentHash,
        Math.floor(new Date(form.creationDate).getTime() / 1000),
        form.metadataURI
      );
      await tx.wait();
      showSuccess('IP registered', form.title);
      setForm({ title: '', ipType: 0, descriptionHash: '', contentIdentifier: '', creationDate: '', metadataURI: '' });
      await load();
    } catch (e) {
      showError('Registration failed', e.shortMessage || e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLicense = async (id) => {
    const licensee = window.prompt('Licensee address?');
    if (!licensee) return;
    const licenseType = window.prompt('License type (Exclusive / Non-Exclusive / Sole)?', 'Non-Exclusive');
    if (!licenseType) return;
    const durationDays = Number(window.prompt('Duration in days (0 = perpetual)?', '365'));
    const royaltyBps = Number(window.prompt('Royalty rate (basis points, e.g. 500 = 5%)?', '500'));
    try {
      const registry = getContract('IPRegistry', true);
      const tx = await registry.createLicense(id, licensee, licenseType, durationDays * 86400, royaltyBps);
      await tx.wait();
      showSuccess('License created', `${licenseType} → ${licensee}`);
      await load();
    } catch (e) {
      showError('License creation failed', e.shortMessage || e.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">IP Registry</h2>
        <p className="text-sm text-[var(--text2)] mt-1">Intellectual property ownership + licensing. Registration fee: {fee ? formatUSDC(fee) : '—'}.</p>
      </div>

      {!account ? (
        <ConnectPrompt label="Connect your wallet to register and manage IP assets." />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm text-[var(--text)]">Register New IP Asset</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <select className="input" value={form.ipType} onChange={(e) => setForm({ ...form, ipType: e.target.value })}>
                {IP_TYPE_LABELS.map((t, i) => <option key={t} value={i}>{t}</option>)}
              </select>
              <input className="input" placeholder="Description hash (IPFS, optional)" value={form.descriptionHash} onChange={(e) => setForm({ ...form, descriptionHash: e.target.value })} />
              <input className="input" placeholder="Content identifier (hashed on submit)" value={form.contentIdentifier} onChange={(e) => setForm({ ...form, contentIdentifier: e.target.value })} />
              <input type="date" className="input" value={form.creationDate} onChange={(e) => setForm({ ...form, creationDate: e.target.value })} />
              <input className="input" placeholder="Metadata URI (ipfs://…, optional)" value={form.metadataURI} onChange={(e) => setForm({ ...form, metadataURI: e.target.value })} />
            </div>
            <p className="text-xs text-[var(--text3)]">The content identifier is hashed client-side (keccak256) into the on-chain uniqueness guard — it's never stored raw.</p>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              {submitting ? 'Registering…' : `Register IP (${fee ? formatUSDC(fee) : '…'})`}
            </button>
          </form>

          <div>
            <h3 className="font-display font-bold text-sm mb-3 text-[var(--text)]">My IP Assets</h3>
            {loading && !assets ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text2)]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : assets && assets.length === 0 ? (
              <div className="card p-8 text-center">
                <Copyright size={22} className="mx-auto mb-2 text-[var(--text3)]" />
                <p className="text-sm text-[var(--text2)]">No IP assets registered yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assets?.map((a) => (
                  <div key={a.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-display font-semibold text-sm text-[var(--text)]">{a.title}</p>
                      <p className="text-xs text-[var(--text3)] mt-0.5">
                        {IP_TYPE_LABELS[Number(a.ipType)]} · created {formatDate(a.creationDate)} {a.licensed && '· licensed'}
                      </p>
                    </div>
                    <button onClick={() => handleCreateLicense(a.id)} className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5">
                      <FileSignature size={12} /> Create License
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
