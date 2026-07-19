import { Star, Lock } from "lucide-react";
import MonogramArt from "./MonogramArt.jsx";

export default function PersonaCard({ persona, onSelect }) {
  const exclusiveGone = !persona.licenses.exclusive.available;

  return (
    <button
      onClick={onSelect}
      className="group flex flex-col text-left"
    >
      <div className="relative">
        <MonogramArt monogram={persona.monogram} gradient={persona.gradient} className="transition-transform group-hover:scale-[1.02]" />
        {exclusiveGone && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-sm bg-ink/80 px-2 py-1 text-[10px] uppercase tracking-widest2 text-champagne">
            <Lock size={10} /> Exclusive claimed
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-sm bg-ink/80 px-2 py-1 text-[10px] uppercase tracking-widest2 text-ivory/70">
          {persona.category}
        </span>
      </div>
      <div className="mt-3 flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg text-ivory">{persona.name}</h3>
          <p className="text-xs text-ivory/40">{persona.house}</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-champagne">
          <Star size={12} fill="currentColor" /> {persona.rating}
        </span>
      </div>
      <p className="mt-1 text-xs text-ivory/50 line-clamp-2">{persona.tagline}</p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-ivory/40">from</span>
        <span className="text-gold">${persona.licenses.shared.price} shared</span>
      </div>
    </button>
  );
}
