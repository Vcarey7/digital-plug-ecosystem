import { useState } from "react";
import { X } from "lucide-react";

export default function AuthModal({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [role, setRole] = useState("buyer");

  const submit = (e) => {
    e.preventDefault();
    onAuthenticated({ name: name.trim() || "Guest Collector", role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-sm border border-gold/20 bg-charcoal p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ivory/50 hover:text-ivory"
        >
          <X size={18} />
        </button>

        <h2 className="font-display text-2xl text-ivory">
          {mode === "signin" ? "Welcome back" : "Join the Atelier"}
        </h2>
        <p className="mt-1 text-sm text-ivory/50">
          Demo authentication — no real account is created.
        </p>

        <div className="mt-6 flex gap-2 rounded-sm bg-ink p-1">
          {["signin", "join"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-sm py-2 text-xs uppercase tracking-widest2 transition-colors ${
                mode === m ? "bg-gold text-ink" : "text-ivory/60"
              }`}
            >
              {m === "signin" ? "Sign In" : "Join"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-ivory outline-none focus:border-gold/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-ivory outline-none focus:border-gold/60"
            />
          </div>

          {mode === "join" && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
                I'm joining as a
              </label>
              <div className="flex gap-2">
                {["buyer", "creator"].map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 rounded-sm border py-2 text-xs uppercase tracking-widest2 ${
                      role === r
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-white/10 text-ivory/60"
                    }`}
                  >
                    {r === "buyer" ? "Collector" : "Creator"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-ivory/40">
            By continuing you confirm you are 18 years or older.
          </p>

          <button
            type="submit"
            className="mt-2 rounded-sm bg-gold py-3 text-xs uppercase tracking-widest2 text-ink transition-colors hover:bg-champagne"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
