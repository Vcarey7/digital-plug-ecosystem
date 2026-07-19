import { ShieldCheck, Sparkles, Wand2, ArrowRight } from "lucide-react";
import { PERSONAS } from "../data/mockData.js";
import PersonaCard from "./PersonaCard.jsx";

const STEPS = [
  {
    icon: Wand2,
    title: "Design or discover a model",
    body: "Commission a bespoke persona from a Red Room Models creator, or license one already curated in the Red Room.",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed before it's listed",
    body: "Every model passes a rights, consent, and content-standards review before it ever reaches the marketplace.",
  },
  {
    icon: Sparkles,
    title: "Launch on your platform",
    body: "Take your license — exclusive or shared — and launch on Fanvue or wherever your audience lives.",
  },
];

const TRUST_STRIP = [
  "Verified creators",
  "Consent-documented personas",
  "18+ only",
  "Fanvue-ready licensing",
];

export default function Home({ onNavigate, onSelectPersona }) {
  const featured = PERSONAS.slice(0, 4);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(60% 60% at 80% 0%, #5c1a2b66 0%, transparent 60%), radial-gradient(50% 50% at 10% 100%, #d1263f22 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
          <p className="mb-5 text-xs uppercase tracking-widest2 text-crimson">
            A private address for the AI creator economy
          </p>
          <h1 className="max-w-3xl font-display text-5xl italic leading-tight text-ivory text-shadow-lg lg:text-7xl">
            Bespoke models, <span className="text-crimson">not stock avatars.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-ivory/60 lg:text-lg">
            Red Room Models is a curated marketplace for licensing AI personas
            and ready-made content collections — crafted for creators building
            premium presences on Fanvue and beyond.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate("marketplace")}
              className="flex items-center gap-2 rounded-sm bg-scarlet px-6 py-3 text-xs uppercase tracking-widest2 text-ink transition-colors hover:bg-crimson"
            >
              Enter the Red Room <ArrowRight size={14} />
            </button>
            <button
              onClick={() => onNavigate("studio")}
              className="rounded-sm border border-scarlet/40 px-6 py-3 text-xs uppercase tracking-widest2 text-scarlet transition-colors hover:bg-scarlet/10"
            >
              Become a Creator
            </button>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-charcoal">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6 lg:px-10">
          {TRUST_STRIP.map((t) => (
            <span key={t} className="text-xs uppercase tracking-widest2 text-ivory/40">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <h2 className="font-display text-3xl italic text-ivory">How it works</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-sm border border-white/10 p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-scarlet/40 text-xs text-scarlet">
                  {i + 1}
                </span>
                <s.icon size={20} className="text-crimson" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-lg text-ivory">{s.title}</h3>
              <p className="mt-2 text-sm text-ivory/50">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-charcoal">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="font-display text-3xl italic text-ivory">Featured models</h2>
            <button
              onClick={() => onNavigate("marketplace")}
              className="hidden text-xs uppercase tracking-widest2 text-scarlet sm:flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {featured.map((p) => (
              <PersonaCard key={p.id} persona={p} onSelect={() => onSelectPersona(p.id)} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
