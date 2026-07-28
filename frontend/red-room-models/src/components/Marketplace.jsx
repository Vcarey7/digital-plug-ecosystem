import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES } from "../data/mockData.js";
import PersonaCard from "./PersonaCard.jsx";

const SORTS = {
  featured: (a, b) => (b.rating || 0) - (a.rating || 0),
  "price-asc": (a, b) => a.licenses.shared.price - b.licenses.shared.price,
  "price-desc": (a, b) => b.licenses.shared.price - a.licenses.shared.price,
};

export default function Marketplace({ onSelectPersona, models }) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");

  const results = useMemo(() => {
    return models.filter((p) => {
      const matchesCategory = category === "All" || p.category === category;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    }).sort(SORTS[sort]);
  }, [models, category, query, sort]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest2 text-crimson">The Red Room</p>
        <h1 className="mt-2 font-display text-4xl italic text-ivory">Browse the collection</h1>
        <p className="mt-2 max-w-2xl text-sm text-ivory/50">
          Each model is reviewed for rights, consent, and content standards before
          it's listed. License a persona exclusively, share it, or buy a
          ready-made content pack.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest2 transition-colors ${
                category === c
                  ? "border-scarlet bg-scarlet/10 text-scarlet"
                  : "border-white/10 text-ivory/60 hover:border-white/30"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2">
            <Search size={14} className="text-ivory/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models or styles"
              className="bg-transparent text-sm text-ivory placeholder:text-ivory/30 outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-sm border border-white/10 bg-ink px-3 py-2 text-xs uppercase tracking-widest2 text-ivory/70 outline-none"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-20 text-center text-sm text-ivory/40">
          No models match that search. Try another style or category.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {results.map((p) => (
            <PersonaCard key={p.id} persona={p} onSelect={() => onSelectPersona(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
