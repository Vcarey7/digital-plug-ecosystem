import { Gem, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const LINKS = [
  { id: "marketplace", label: "The Red Room" },
  { id: "studio", label: "Become a Creator" },
  { id: "policy", label: "Trust & Compliance" },
];

export default function NavBar({ view, onNavigate, auth, onOpenAuth }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = auth.profile?.display_name || auth.user?.email;
  const role = auth.profile?.role;

  const links = role === "creator" ? [...LINKS, { id: "my-models", label: "My Models" }] : LINKS;

  const go = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <button
          onClick={() => go("home")}
          className="flex items-center gap-2 font-display text-xl tracking-wide text-ivory"
        >
          <Gem size={20} className="text-scarlet" strokeWidth={1.5} />
          <span>
            Red Room <span className="italic text-crimson">Models</span>
          </span>
        </button>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className={`text-xs uppercase tracking-widest2 transition-colors ${
                view === l.id ? "text-scarlet" : "text-ivory/70 hover:text-ivory"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {auth.user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest2 text-ivory/80">
                {displayName} {role && <span className="text-crimson">· {role}</span>}
              </span>
              <button
                onClick={() => auth.signOut()}
                title="Sign out"
                className="text-ivory/50 hover:text-scarlet"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="rounded-sm border border-scarlet/50 px-4 py-2 text-xs uppercase tracking-widest2 text-scarlet transition-colors hover:bg-scarlet hover:text-ink"
            >
              Sign In
            </button>
          )}
        </div>

        <button className="md:hidden text-ivory" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="flex flex-col gap-1 border-t border-white/10 px-6 py-4 md:hidden">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="py-2 text-left text-xs uppercase tracking-widest2 text-ivory/80"
            >
              {l.label}
            </button>
          ))}
          {auth.user ? (
            <button
              onClick={() => {
                auth.signOut();
                setMobileOpen(false);
              }}
              className="mt-2 rounded-sm border border-scarlet/50 px-4 py-2 text-left text-xs uppercase tracking-widest2 text-scarlet"
            >
              Sign out ({displayName})
            </button>
          ) : (
            <button
              onClick={() => {
                onOpenAuth();
                setMobileOpen(false);
              }}
              className="mt-2 rounded-sm border border-scarlet/50 px-4 py-2 text-left text-xs uppercase tracking-widest2 text-scarlet"
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </header>
  );
}
