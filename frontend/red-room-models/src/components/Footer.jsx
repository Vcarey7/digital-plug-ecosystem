import { Gem } from "lucide-react";

export default function Footer({ onNavigate }) {
  return (
    <footer className="border-t border-white/10 bg-charcoal">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 font-display text-lg text-ivory">
              <Gem size={16} className="text-scarlet" strokeWidth={1.5} />
              Red Room <span className="italic text-crimson">Models</span>
            </div>
            <p className="mt-3 text-sm text-ivory/50">
              A private marketplace for bespoke AI models and curated content
              collections, built for creators launching on Fanvue and beyond.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <div className="mb-3 text-xs uppercase tracking-widest2 text-ivory/40">
                Marketplace
              </div>
              <button onClick={() => onNavigate("marketplace")} className="block py-1 text-ivory/70 hover:text-scarlet">
                Browse Models
              </button>
              <button onClick={() => onNavigate("studio")} className="block py-1 text-ivory/70 hover:text-scarlet">
                Become a Creator
              </button>
            </div>
            <div>
              <div className="mb-3 text-xs uppercase tracking-widest2 text-ivory/40">
                Trust
              </div>
              <button onClick={() => onNavigate("policy")} className="block py-1 text-ivory/70 hover:text-scarlet">
                Compliance Standards
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-xs text-ivory/30">
          © {new Date().getFullYear()} Red Room Models. Concept demo — 18+ platform,
          no real content is generated or sold here.
        </div>
      </div>
    </footer>
  );
}
