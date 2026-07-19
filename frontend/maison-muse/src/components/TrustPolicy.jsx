import { ShieldCheck, Fingerprint, Ban, Eye, Scale, FileWarning } from "lucide-react";

const SECTIONS = [
  {
    icon: Fingerprint,
    title: "Consent & likeness",
    body: "Every muse is either fully synthetic or backed by a documented, signed model release for any real-person likeness used in training. Creators attest to this on every listing, and we can request the underlying documentation at any time.",
  },
  {
    icon: Ban,
    title: "Zero tolerance for minors",
    body: "Personas that depict, imply, or could reasonably be mistaken for a minor — in appearance, backstory, or content — are removed immediately and reported. This applies without exception, including stylistic 'youthful' framing.",
  },
  {
    icon: Eye,
    title: "AI disclosure",
    body: "Creators are required to label content as AI-generated wherever their destination platform (Fanvue and others) mandates disclosure. We do not support misrepresenting AI personas as real people without appropriate labeling.",
  },
  {
    icon: Scale,
    title: "IP & originality",
    body: "Creators warrant that submitted assets are original or properly licensed. Exclusive buyers receive a transferable rights certificate; disputes over originality can result in listing removal and account review.",
  },
  {
    icon: FileWarning,
    title: "Review before listing",
    body: "Every submission passes a human curatorial and compliance review — checking rights documentation, content standards, and platform-policy fit — before it becomes visible in the Atelier.",
  },
  {
    icon: ShieldCheck,
    title: "Age-gated platform",
    body: "Maison Muse is an 18+ platform for both creators and buyers. Age assurance is required at account creation, and access is revoked if misrepresented.",
  },
];

export default function TrustPolicy() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-10">
      <p className="text-xs uppercase tracking-widest2 text-champagne">Trust & Compliance</p>
      <h1 className="mt-2 font-display text-4xl italic text-ivory">
        The Maison Muse standard
      </h1>
      <p className="mt-4 text-ivory/60">
        Licensing an AI persona is not the same as licensing a stock photo. We
        built these standards because the muses on this platform are meant for
        real creator businesses, on real platforms, with real audiences — and
        that only works if the foundation is trustworthy.
      </p>

      <div className="mt-12 flex flex-col gap-8">
        {SECTIONS.map((s) => (
          <div key={s.title} className="flex gap-4 border-b border-white/10 pb-8">
            <s.icon size={22} className="mt-1 shrink-0 text-gold" strokeWidth={1.5} />
            <div>
              <h2 className="font-display text-xl text-ivory">{s.title}</h2>
              <p className="mt-2 text-sm text-ivory/60">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-sm border border-gold/20 bg-charcoal p-6 text-sm text-ivory/50">
        This page describes product-level policy for a concept demo. A production
        deployment would additionally require real identity/age verification,
        human moderation staffing, a takedown/appeals process, and legal review
        specific to each jurisdiction and destination platform's terms of service.
      </div>
    </div>
  );
}
