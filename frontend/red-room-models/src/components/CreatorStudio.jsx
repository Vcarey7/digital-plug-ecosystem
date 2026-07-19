import { useState } from "react";
import { CheckCircle2, ShieldAlert, Upload } from "lucide-react";
import { CATEGORIES } from "../data/mockData.js";

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

export default function CreatorStudio() {
  const [form, setForm] = useState({
    name: "",
    category: CATEGORIES[0],
    tags: "",
    backstory: "",
    exclusivePrice: "",
    sharedPrice: "",
  });
  const [checks, setChecks] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const allChecked = CHECKLIST.every((c) => checks[c.key]);
  const canSubmit =
    allChecked && form.name.trim() && form.backstory.trim() && form.exclusivePrice && form.sharedPrice;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <CheckCircle2 size={40} className="mx-auto text-scarlet" strokeWidth={1.2} />
        <h1 className="mt-6 font-display text-3xl italic text-ivory">Submitted for review</h1>
        <p className="mt-3 text-sm text-ivory/60">
          Thank you — <span className="text-crimson">{form.name}</span> has been queued for
          curatorial and compliance review. Our team verifies rights, consent
          documentation, and content standards before anything is listed. You'll
          hear back within 48 hours.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setForm({
              name: "",
              category: CATEGORIES[0],
              tags: "",
              backstory: "",
              exclusivePrice: "",
              sharedPrice: "",
            });
            setChecks({});
          }}
          className="mt-8 rounded-sm border border-scarlet/40 px-6 py-3 text-xs uppercase tracking-widest2 text-scarlet hover:bg-scarlet/10"
        >
          Submit another model
        </button>
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
          <div className="flex items-center gap-3 rounded-sm border border-dashed border-white/15 px-4 py-6 text-sm text-ivory/40">
            <Upload size={18} />
            Drag reference images here, or connect your generation pipeline. (Demo
            only — uploads are not processed.)
          </div>
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

        <button
          type="submit"
          disabled={!canSubmit}
          className={`rounded-sm px-6 py-3 text-xs uppercase tracking-widest2 transition-colors ${
            canSubmit ? "bg-scarlet text-ink hover:bg-crimson" : "cursor-not-allowed bg-white/5 text-ivory/30"
          }`}
        >
          Submit for Red Room review
        </button>
      </form>
    </div>
  );
}
