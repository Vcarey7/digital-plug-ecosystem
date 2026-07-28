import { useMemo, useState } from "react";
import { ArrowLeft, Check, Lock, Star } from "lucide-react";
import MonogramArt from "./MonogramArt.jsx";

export default function PersonaDetail({ personaId, findModel, onBack, onCheckout }) {
  const persona = findModel(personaId);
  const [tier, setTier] = useState(null);
  const [selectedPacks, setSelectedPacks] = useState(new Set());

  const togglePack = (id) => {
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const total = useMemo(() => {
    if (!persona) return 0;
    let sum = 0;
    if (tier) sum += persona.licenses[tier].price;
    persona.contentPacks.forEach((pack) => {
      if (selectedPacks.has(pack.id)) sum += pack.price;
    });
    return sum;
  }, [persona, tier, selectedPacks]);

  if (!persona) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-ivory/60">That model could not be found.</p>
        <button onClick={onBack} className="mt-4 text-scarlet underline">
          Back to the Red Room
        </button>
      </div>
    );
  }

  const canCheckout = tier || selectedPacks.size > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-xs uppercase tracking-widest2 text-ivory/50 hover:text-ivory"
      >
        <ArrowLeft size={14} /> Back to the Red Room
      </button>

      <div className="grid gap-12 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <MonogramArt monogram={persona.monogram} gradient={persona.gradient} ratio="aspect-[3/4]" />
        </div>

        <div className="lg:col-span-3">
          <span className="text-xs uppercase tracking-widest2 text-crimson">
            {persona.category} · {persona.house}
          </span>
          <h1 className="mt-2 font-display text-4xl italic text-ivory">{persona.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-ivory/50">
            {persona.rating ? (
              <>
                <Star size={14} className="text-crimson" fill="currentColor" />
                {persona.rating} · {persona.reviews} licenses issued
              </>
            ) : (
              <span className="uppercase tracking-widest2 text-xs text-crimson">
                New to the Red Room
              </span>
            )}
          </div>
          <p className="mt-4 text-ivory/70">{persona.backstory}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {persona.tags.map((t) => (
              <span key={t} className="rounded-full border border-white/10 px-3 py-1 text-xs text-ivory/50">
                {t}
              </span>
            ))}
          </div>

          <h2 className="mt-10 font-display text-xl text-ivory">License this model</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <button
              disabled={!persona.licenses.exclusive.available}
              onClick={() => setTier(tier === "exclusive" ? null : "exclusive")}
              className={`rounded-sm border p-4 text-left transition-colors ${
                !persona.licenses.exclusive.available
                  ? "cursor-not-allowed border-white/5 opacity-40"
                  : tier === "exclusive"
                  ? "border-scarlet bg-scarlet/10"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest2 text-ivory/60">Exclusive</span>
                {!persona.licenses.exclusive.available && <Lock size={14} className="text-ivory/40" />}
                {tier === "exclusive" && <Check size={14} className="text-scarlet" />}
              </div>
              <p className="mt-2 font-display text-2xl text-ivory">
                ${persona.licenses.exclusive.price.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-ivory/40">
                {persona.licenses.exclusive.available
                  ? "Sole rights. Retired from the marketplace after purchase."
                  : "Already claimed by another collector."}
              </p>
            </button>

            <button
              onClick={() => setTier(tier === "shared" ? null : "shared")}
              className={`rounded-sm border p-4 text-left transition-colors ${
                tier === "shared" ? "border-scarlet bg-scarlet/10" : "border-white/10 hover:border-white/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest2 text-ivory/60">Shared</span>
                {tier === "shared" && <Check size={14} className="text-scarlet" />}
              </div>
              <p className="mt-2 font-display text-2xl text-ivory">
                ${persona.licenses.shared.price.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-ivory/40">
                {persona.licenses.shared.licensedCount > 0
                  ? `Non-exclusive. Already licensed ${persona.licenses.shared.licensedCount} times.`
                  : "Non-exclusive. Not yet licensed."}
              </p>
            </button>
          </div>

          {persona.contentPacks.length > 0 && (
          <>
          <h2 className="mt-10 font-display text-xl text-ivory">Content packs</h2>
          <div className="mt-4 flex flex-col gap-3">
            {persona.contentPacks.map((pack) => {
              const active = selectedPacks.has(pack.id);
              return (
                <button
                  key={pack.id}
                  onClick={() => togglePack(pack.id)}
                  className={`flex items-center justify-between rounded-sm border p-4 text-left transition-colors ${
                    active ? "border-scarlet bg-scarlet/10" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div>
                    <p className="text-sm text-ivory">{pack.title}</p>
                    <p className="mt-1 text-xs text-ivory/40">
                      {pack.mediaCount} pieces · {pack.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-scarlet">${pack.price}</span>
                    {active && <Check size={14} className="text-scarlet" />}
                  </div>
                </button>
              );
            })}
          </div>
          </>
          )}

          <div className="mt-10 flex items-center justify-between rounded-sm border border-white/10 p-5">
            <div>
              <p className="text-xs uppercase tracking-widest2 text-ivory/40">Total</p>
              <p className="font-display text-2xl text-ivory">${total.toLocaleString()}</p>
            </div>
            <button
              disabled={!canCheckout}
              onClick={() => onCheckout({ personaId, tier, packIds: [...selectedPacks] })}
              className={`rounded-sm px-6 py-3 text-xs uppercase tracking-widest2 transition-colors ${
                canCheckout
                  ? "bg-scarlet text-ink hover:bg-crimson"
                  : "cursor-not-allowed bg-white/5 text-ivory/30"
              }`}
            >
              Reserve this model
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
