import React, { useState, useEffect, useCallback } from 'react';
import { Landmark, Loader2, PlusCircle, ClipboardCheck } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';
import { useNotification } from '../contexts/NotificationContext';
import ConnectPrompt from '../components/shared/ConnectPrompt';
import { LICENSE_TYPE_LABELS } from '../config/abis';
import { formatUSDC, formatDate } from '../lib/format';

const LICENSE_STATUS_LABELS = ['Active', 'Pending Renewal', 'Suspended', 'Revoked', 'Transferred', 'Expired'];

export default function LicenseRegistryView() {
  const { account, addresses, getContract, ensureAllowance } = useWeb3();
  const { showSuccess, showError } = useNotification();

  const [fee, setFee] = useState(null);
  const [licenses, setLicenses] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    licenseNumber: '', stateCode: '', licenseType: 0, businessName: '',
    businessAddress: '', issueDate: '', expirationDate: '', metadataURI: '',
  });

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const registry = getContract('LicenseRegistry');
      const [f, ids] = await Promise.all([registry.registrationFee(), registry.getOperatorLicenses(account)]);
      setFee(f);
      const details = await Promise.all(ids.map((id) => registry.licenses(id)));
      setLicenses(ids.map((id, i) => ({ id: id.toString(), ...details[i].toObject() })));
    } catch (e) {
      showError('Could not load licenses', e.shortMessage || e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [account, getContract, showError]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { licenseNumber, stateCode, businessName, businessAddress, issueDate, expirationDate } = form;
    if (!licenseNumber || !stateCode || !businessName || !businessAddress || !issueDate || !expirationDate) {
      return showError('Missing fields', 'All fields except metadata URI are required.');
    }
    setSubmitting(true);
    try {
      const registryRead = getContract('LicenseRegistry');
      const currentFee = fee ?? (await registryRead.registrationFee());
      await ensureAllowance('usdc', addresses.contracts.LicenseRegistry, currentFee);
      const registry = getContract('LicenseRegistry', true);
      const tx = await registry.registerLicense(
        licenseNumber, stateCode, Number(form.licenseType), businessName, businessAddress,
        Math.floor(new Date(issueDate).getTime() / 1000),
        Math.floor(new Date(expirationDate).getTime() / 1000),
        form.metadataURI
      );
      await tx.wait();
      showSuccess('License registered', licenseNumber);
      setForm({ licenseNumber: '', stateCode: '', licenseType: 0, businessName: '', businessAddress: '', issueDate: '', expirationDate: '', metadataURI: '' });
      await load();
    } catch (e) {
      showError('Registration failed', e.shortMessage || e.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogCompliance = async (id) => {
    const eventHash = window.prompt('Compliance event hash / description?');
    if (!eventHash) return;
    try {
      const registry = getContract('LicenseRegistry', true);
      const tx = await registry.logComplianceEvent(id, eventHash);
      await tx.wait();
      showSuccess('Compliance event logged', eventHash);
    } catch (e) {
      showError('Log failed', e.shortMessage || e.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-extrabold text-2xl text-[var(--text)]">License Registry</h2>
        <p className="text-sm text-[var(--text2)] mt-1">Cannabis license tracking + verification. Registration fee: {fee ? formatUSDC(fee) : '—'}.</p>
      </div>

      {!account ? (
        <ConnectPrompt label="Connect your wallet to register and manage licenses." />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="card p-5 space-y-3">
            <h3 className="font-display font-bold text-sm text-[var(--text)]">Register New License</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="input" placeholder="License number" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
              <input className="input" placeholder="State code (e.g. CA)" value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value })} />
              <select className="input" value={form.licenseType} onChange={(e) => setForm({ ...form, licenseType: e.target.value })}>
                {LICENSE_TYPE_LABELS.map((t, i) => <option key={t} value={i}>{t}</option>)}
              </select>
              <input className="input" placeholder="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              <input className="input sm:col-span-2" placeholder="Business address" value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} />
              <div>
                <label className="text-xs text-[var(--text3)] block mb-1">Issue date</label>
                <input type="date" className="input" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[var(--text3)] block mb-1">Expiration date</label>
                <input type="date" className="input" value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
              </div>
              <input className="input sm:col-span-2" placeholder="Metadata URI (ipfs://…, optional)" value={form.metadataURI} onChange={(e) => setForm({ ...form, metadataURI: e.target.value })} />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
              {submitting ? 'Registering…' : `Register License (${fee ? formatUSDC(fee) : '…'})`}
            </button>
          </form>

          <div>
            <h3 className="font-display font-bold text-sm mb-3 text-[var(--text)]">My Licenses</h3>
            {loading && !licenses ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text2)]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : licenses && licenses.length === 0 ? (
              <div className="card p-8 text-center">
                <Landmark size={22} className="mx-auto mb-2 text-[var(--text3)]" />
                <p className="text-sm text-[var(--text2)]">No licenses registered yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {licenses?.map((l) => (
                  <div key={l.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-display font-semibold text-sm text-[var(--text)]">{l.businessName} — {l.licenseNumber}</p>
                      <p className="text-xs text-[var(--text3)] mt-0.5">
                        {l.stateCode} · {LICENSE_TYPE_LABELS[Number(l.licenseType)]} · {LICENSE_STATUS_LABELS[Number(l.status)]} · expires {formatDate(l.expirationDate)}
                      </p>
                    </div>
                    <button onClick={() => handleLogCompliance(l.id)} className="btn-secondary flex items-center gap-1.5 !px-3 !py-1.5">
                      <ClipboardCheck size={12} /> Log Compliance
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
