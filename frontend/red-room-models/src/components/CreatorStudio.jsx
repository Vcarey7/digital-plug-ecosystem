import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Upload, X } from "lucide-react";
import { CATEGORIES } from "../data/mockData.js";
import { isSupabaseConfigured, REFERENCE_BUCKET, supabase } from "../lib/supabaseClient.js";

const CHECKLIST = [
  {
    key: "consent",
    label:
      "This model is either fully synthetic, or any real-person likeness used in training is backed by a documented, signed model release.",
  },
  {
    key: "noMinors",
    label:
      "I confirm this persona does not depict, and will never be used to depict, a minor — in appearance, context, or description.",
  },
  {
    key: "disclosure",
    label:
      "I will label content as AI-generated wherever the destination platform (e.g. Fanvue) requires disclosure.",
  },
  {
    key: "originality",
    label:
      "I own or have full rights to every asset submitted, and this listing does not infringe another creator's IP.",
  },
];

const GRADIENTS = [
  ["#3a2e39", "#c9a769"],
  ["#141018", "#5c1a2b"],
  ["#123a3a", "#cda86a"],
  ["#1b1024", "#8a5fb0"],
  ["#241a12", "#d9b45b"],
  ["#0f1620", "#7d97b3"],
  ["#1a1414", "#7a2e2e"],
  ["#132420", "#4fae94"],
];

const emptyForm = {
  name: "",
  category: CATEGORIES[0],
  tags: "",
  backstory: "",
  exclusivePrice: "",
  sharedPrice: "",
};

export default function CreatorStudio({ auth, onOpenAuth, onNavigate }) {
  const [form, setForm] = useState(emptyForm);
  const [checks, setChecks] = useState({});
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedModel, setSubmittedModel] = useState(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const allChecked = CHECKLIST.every((c) => checks[c.key]);
  const canSubmit =
    allChecked && form.name.trim() && form.backstory.trim() && form.exclusivePrice && form.sharedPrice;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const resetForm = () => {
    setForm(emptyForm);
    setChecks({});
    setFiles([]);
    setSubmittedModel(null);
    setSubmitError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !auth.user) return;
    setSubmitting(true);
    setSubmitError("");

    const [gradient_from, gradient_to] = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { data: model, error: insertError } = await supabase
      .from("models")
      .insert({
        creator_id: auth.user.id,
        name: form.name.trim(),
        category: form.category,
        tags,
        backstory: form.backstory.trim(),
        gradient_from,
        gradient_to,
        exclusive_price: Number(form.exclusivePrice),
        shared_price: Number(form.sharedPrice),
      })
      .select()
      .single();

    if (insertError) {
      setSubmitError(insertError.message);
      setSubmitting(false);
      return;
    }

    for (const file of files) {
      const path = `${auth.user.id}/${model.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(REFERENCE_BUCKET)
        .upload(path, file);
      if (uploadError) {
        setSubmitError(`Model saved, but an image failed to upload: ${uploadError.message}`);
        continue;
      }
      await supabase.from("model_images").insert({ model_id: model.id, storage_path: path });
    }

    setSubmitting(false);
    setSubmittedModel(model);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <AlertTriangle size={36} className="mx-auto text-scarlet" strokeWidth={1.2} />
        <h1 className="mt-6 font-display text-3xl italic text-ivory">No backend connected</h1>
        <p className="mt-3 text-sm text-ivory/60">
          Creator Studio needs a Supabase project to store submissions and reference
          images. Run <code className="text-ivory/80">supabase/schema.sql</code> in
          your project and set <code className="text-ivory/80">VITE_SUPABASE_URL</code>{" "}
          / <code className="text-ivory/80">VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code className="text-ivory/80">.env.local</code> — see the README.
        </p>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <ShieldAlert size={36} className="mx-auto text-scarlet" strokeWidth={1.2} />
        <h1 className="mt-6 font-display text-3xl italic text-ivory">Sign in to submit a model</h1>
        <p className="mt-3 text-sm text-ivory/60">
          Creator Studio needs an account so your submission and reference images
          are tied to you and can be reviewed.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-8 rounded-sm bg-scarlet px-6 py-3 text-xs uppercase tracking-widest2 text-ink hover:bg-crimson"
        >
          Sign in / Join
        </button>
      </div>
    );
  }

  if (submittedModel) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <CheckCircle2 size={40} className="mx-auto text-scarlet" strokeWidth={1.2} />
        <h1 className="mt-6 font-display text-3xl italic text-ivory">Submitted for review</h1>
        <p className="mt-3 text-sm text-ivory/60">
          Thank you — <span className="text-crimson">{submittedModel.name}</span> has
          been queued for curatorial and compliance review. We verify rights,
          consent documentation, and content standards before anything is listed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            onClick={() => onNavigate("my-models")}
            className="rounded-sm bg-scarlet px-6 py-3 text-xs uppercase tracking-widest2 text-ink hover:bg-crimson"
          >
            View my models
          </button>
          <button
            onClick={resetForm}
            className="rounded-sm border border-scarlet/40 px-6 py-3 text-xs uppercase tracking-widest2 text-scarlet hover:bg-scarlet/10"
          >
            Submit another model
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 lg:px-10">
      <p className="text-xs uppercase tracking-widest2 text-crimson">Creator Studio</p>
      <h1 className="mt-2 font-display text-4xl italic text-ivory">List a new model</h1>
      <p className="mt-2 text-sm text-ivory/50">
        Every submission is reviewed by hand before it reaches the Red Room. Listings
        that can't demonstrate consent, originality, and compliance are rejected.
      </p>

      <form onSubmit={submit} className="mt-10 flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
              Model name
            </label>
            <input
              value={form.name}
              onChange={update("name")}
              placeholder="e.g. Rosalind Faye"
              className="w-full rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
              Category
            </label>
            <select
              value={form.category}
              onChange={update("category")}
              className="w-full rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
            Style tags (comma separated)
          </label>
          <input
            value={form.tags}
            onChange={update("tags")}
            placeholder="e.g. editorial, warm-tone, minimalist"
            className="w-full rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
            Backstory / bio
          </label>
          <textarea
            value={form.backstory}
            onChange={update("backstory")}
            rows={4}
            placeholder="Describe the model's aesthetic, tone, and intended use."
            className="w-full rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
              Exclusive license price (USD)
            </label>
            <input
              type="number"
              min="0"
              value={form.exclusivePrice}
              onChange={update("exclusivePrice")}
              className="w-full rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
              Shared license price (USD)
            </label>
            <input
              type="number"
              min="0"
              value={form.sharedPrice}
              onChange={update("sharedPrice")}
              className="w-full rounded-sm border border-white/10 bg-charcoal px-3 py-2 text-sm text-ivory outline-none focus:border-scarlet/60"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest2 text-ivory/40">
            Reference set
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-dashed border-white/15 px-4 py-6 text-sm text-ivory/40 hover:border-scarlet/40">
            <Upload size={18} />
            Click to choose reference images, or drop them here.
            <input type="file" accept="image/*" multiple onChange={addFiles} className="hidden" />
          </label>

          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
              {previews.map((src, i) => (
                <div key={src} className="group relative aspect-square overflow-hidden rounded-sm border border-white/10">
                  <img src={src} alt={files[i].name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 rounded-full bg-ink/80 p-1 text-ivory/70 opacity-0 transition-opacity group-hover:opacity-100 hover:text-scarlet"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-sm border border-scarlet/20 bg-charcoal p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest2 text-scarlet">
            <ShieldAlert size={14} /> Compliance attestation
          </div>
          <div className="flex flex-col gap-3">
            {CHECKLIST.map((c) => (
              <label key={c.key} className="flex items-start gap-3 text-sm text-ivory/70">
                <input
                  type="checkbox"
                  checked={!!checks[c.key]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                  className="mt-1 accent-scarlet"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {submitError && <p className="text-sm text-scarlet">{submitError}</p>}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className={`rounded-sm px-6 py-3 text-xs uppercase tracking-widest2 transition-colors ${
            canSubmit && !submitting
              ? "bg-scarlet text-ink hover:bg-crimson"
              : "cursor-not-allowed bg-white/5 text-ivory/30"
          }`}
        >
          {submitting ? "Submitting…" : "Submit for Red Room review"}
        </button>
      </form>
    </div>
  );
}
