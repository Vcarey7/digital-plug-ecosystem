import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function AuthModal({ auth, onClose }) {
  const [mode, setMode] = useState("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("buyer");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    if (mode === "join") {
      const { error: signUpError } = await auth.signUp({
        email,
        password,
        displayName: displayName.trim() || "Collector",
        role,
      });
      setSubmitting(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setNotice("Account created. Check your email to confirm it, then sign in.");
      setMode("signin");
      return;
    }

    const { error: signInError } = await auth.signIn({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-sm border border-scarlet/20 bg-charcoal p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ivory/50 hover:text-ivory"
        >
          <X size={18} />
        </button>

        <h2 className="font-display text-2xl text-ivory">
          {mode === "signin" ? "Welcome back" : "Join the Red Room"}
        </h2>

        {!auth.configured ? (
          <div className="mt-4 flex gap-3 rounded-sm border border-scarlet/30 bg-ink p-4 text-sm text-ivory/60">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-scarlet" />
            <p>
              No backend is connected yet. Create a Supabase project, run{" "}
              <code className="text-ivory/80">supabase/schema.sql</code>, and set{" "}
              <code className="text-ivory/80">VITE_SUPABASE_URL</code> /{" "}
              <code className="text-ivory/80">VITE_SUPABASE_ANON_KEY</code> in{" "}
              <code className="text-ivory/80">.env.local</code> — see the README.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2 rounded-sm bg-ink p-1">
              {["signin", "join"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError("");
                    setNotice("");
                  }}
                  className={`flex-1 rounded-sm py-2 text-xs uppercase tracking-widest2 transition-colors ${
                    mode === m ? "bg-scarlet text-ink" : "text-ivory/60"
                  }`}
                >
                  {m === "signin" ? "Sign In" : "Join"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              {mode === "join" && (
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
                    Name
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-sm border border-white/10 bg-ink px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
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
                            ? "border-scarlet bg-scarlet/10 text-scarlet"
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

              {error && <p className="text-xs text-scarlet">{error}</p>}
              {notice && <p className="text-xs text-crimson">{notice}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-sm bg-scarlet py-3 text-xs uppercase tracking-widest2 text-ink transition-colors hover:bg-crimson disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
