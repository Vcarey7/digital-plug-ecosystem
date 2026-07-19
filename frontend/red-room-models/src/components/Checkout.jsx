import { useMemo, useState } from "react";
import { BadgeCheck, ArrowLeft } from "lucide-react";
import { findPersona } from "../data/mockData.js";

const genCertId = () =>
  `MM-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-5)}`;

export default function Checkout({ order, onBack, onNavigate }) {
  const persona = order ? findPersona(order.personaId) : null;
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [certId] = useState(genCertId);

  const packs = useMemo(() => {
    if (!persona || !order) return [];
    return persona.contentPacks.filter((p) => order.packIds.includes(p.id));
  }, [persona, order]);

  if (!order || !persona) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-ivory/60">Nothing to check out yet.</p>
        <button onClick={() => onNavigate("marketplace")} className="mt-4 text-scarlet underline">
          Browse the Red Room
        </button>
      </div>
    );
  }

  const tierPrice = order.tier ? persona.licenses[order.tier].price : 0;
  const packsTotal = packs.reduce((sum, p) => sum + p.price, 0);
  const total = tierPrice + packsTotal;

  if (confirmed) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <BadgeCheck size={40} className="mx-auto text-scarlet" strokeWidth={1.2} />
        <h1 className="mt-6 font-display text-3xl italic text-ivory">License confirmed</h1>
        <p className="mt-3 text-sm text-ivory/60">
          Your certificate for <span className="text-crimson">{persona.name}</span> has been issued.
        </p>
        <div className="mt-6 rounded-sm border border-scarlet/30 bg-charcoal p-6 text-left">
          <p className="text-xs uppercase tracking-widest2 text-ivory/40">Certificate ID</p>
          <p className="mt-1 font-display text-xl text-scarlet">{certId}</p>
          {order.tier && (
            <p className="mt-3 text-sm text-ivory/60">
              {order.tier === "exclusive" ? "Exclusive" : "Shared"} license — {persona.name}
            </p>
          )}
          {packs.map((p) => (
            <p key={p.id} className="text-sm text-ivory/60">
              Content pack — {p.title}
            </p>
          ))}
        </div>
        <button
          onClick={() => onNavigate("marketplace")}
          className="mt-8 rounded-sm border border-scarlet/40 px-6 py-3 text-xs uppercase tracking-widest2 text-scarlet hover:bg-scarlet/10"
        >
          Back to the Red Room
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 lg:px-10">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-xs uppercase tracking-widest2 text-ivory/50 hover:text-ivory"
      >
        <ArrowLeft size={14} /> Back to {persona.name}
      </button>

      <h1 className="font-display text-3xl italic text-ivory">Confirm your license</h1>

      <div className="mt-8 rounded-sm border border-white/10 p-6">
        <p className="text-xs uppercase tracking-widest2 text-ivory/40">Order summary</p>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          {order.tier && (
            <div className="flex justify-between">
              <span className="text-ivory/70">
                {order.tier === "exclusive" ? "Exclusive" : "Shared"} license — {persona.name}
              </span>
              <span className="text-ivory">${tierPrice.toLocaleString()}</span>
            </div>
          )}
          {packs.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span className="text-ivory/70">Content pack — {p.title}</span>
              <span className="text-ivory">${p.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-white/10 pt-4">
          <span className="text-ivory">Total</span>
          <span className="font-display text-xl text-scarlet">${total.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-xs uppercase tracking-widest2 text-ivory/40">Payment</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            placeholder="Card number"
            className="sm:col-span-2 rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
          />
          <input
            placeholder="MM / YY"
            className="rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
          />
          <input
            placeholder="CVC"
            className="rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
          />
        </div>
        <p className="mt-2 text-xs text-ivory/30">Demo checkout — no real payment is processed.</p>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm text-ivory/60">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 accent-scarlet"
        />
        I agree to the license terms and Red Room Models' Trust & Compliance standards.
      </label>

      <button
        disabled={!agreed}
        onClick={() => setConfirmed(true)}
        className={`mt-6 w-full rounded-sm py-3 text-xs uppercase tracking-widest2 transition-colors ${
          agreed ? "bg-scarlet text-ink hover:bg-crimson" : "cursor-not-allowed bg-white/5 text-ivory/30"
        }`}
      >
        Confirm license — ${total.toLocaleString()}
      </button>
    </div>
  );
}
