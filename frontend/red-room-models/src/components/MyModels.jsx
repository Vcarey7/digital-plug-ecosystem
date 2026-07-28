import { useEffect, useState } from "react";
import { AlertTriangle, ImageOff, Plus, ShieldAlert } from "lucide-react";
import { isSupabaseConfigured, REFERENCE_BUCKET, supabase } from "../lib/supabaseClient.js";

const STATUS_STYLES = {
  approved: "border-scarlet text-scarlet bg-scarlet/10",
  pending: "border-white/20 text-ivory/60",
  rejected: "border-white/10 text-ivory/30",
};

export default function MyModels({ auth, onNavigate }) {
  const [models, setModels] = useState(null);
  const [thumbnails, setThumbnails] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !auth.user) return;
    let cancelled = false;

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("models")
        .select("*")
        .eq("creator_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setModels(data);

      const entries = await Promise.all(
        data.map(async (m) => {
          const { data: images } = await supabase
            .from("model_images")
            .select("storage_path")
            .eq("model_id", m.id)
            .limit(1);
          const path = images?.[0]?.storage_path;
          if (!path) return [m.id, null];
          const { data: signed } = await supabase.storage
            .from(REFERENCE_BUCKET)
            .createSignedUrl(path, 3600);
          return [m.id, signed?.signedUrl ?? null];
        })
      );
      if (!cancelled) setThumbnails(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <AlertTriangle size={36} className="mx-auto text-scarlet" strokeWidth={1.2} />
        <h1 className="mt-6 font-display text-3xl italic text-ivory">No backend connected</h1>
        <p className="mt-3 text-sm text-ivory/60">
          Connect a Supabase project to see your submissions here — see the README.
        </p>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <ShieldAlert size={36} className="mx-auto text-scarlet" strokeWidth={1.2} />
        <h1 className="mt-6 font-display text-3xl italic text-ivory">Sign in to view your models</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-14 lg:px-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest2 text-crimson">Creator Studio</p>
          <h1 className="mt-2 font-display text-4xl italic text-ivory">My models</h1>
        </div>
        <button
          onClick={() => onNavigate("studio")}
          className="flex items-center gap-2 rounded-sm bg-scarlet px-5 py-2.5 text-xs uppercase tracking-widest2 text-ink hover:bg-crimson"
        >
          <Plus size={14} /> Submit a model
        </button>
      </div>

      {error && <p className="text-sm text-scarlet">{error}</p>}

      {models === null ? (
        <p className="text-sm text-ivory/40">Loading…</p>
      ) : models.length === 0 ? (
        <div className="rounded-sm border border-white/10 py-20 text-center">
          <p className="text-sm text-ivory/50">You haven't submitted any models yet.</p>
          <button
            onClick={() => onNavigate("studio")}
            className="mt-4 text-xs uppercase tracking-widest2 text-scarlet underline"
          >
            Submit your first model
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {models.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-4 rounded-sm border border-white/10 p-5 sm:flex-row sm:items-center"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-sm border border-white/10 bg-charcoal">
                {thumbnails[m.id] ? (
                  <img src={thumbnails[m.id]} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ivory/20">
                    <ImageOff size={20} />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-lg text-ivory">{m.name}</h2>
                  <span
                    className={`rounded-full border px-3 py-0.5 text-[10px] uppercase tracking-widest2 ${STATUS_STYLES[m.status]}`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ivory/40">
                  {m.category} · Exclusive ${Number(m.exclusive_price).toLocaleString()} · Shared $
                  {Number(m.shared_price).toLocaleString()}
                </p>
                {m.status === "rejected" && m.review_note && (
                  <p className="mt-2 text-xs text-ivory/50">Curator note: {m.review_note}</p>
                )}
                {m.status === "pending" && (
                  <p className="mt-2 text-xs text-ivory/40">Awaiting curatorial and compliance review.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
