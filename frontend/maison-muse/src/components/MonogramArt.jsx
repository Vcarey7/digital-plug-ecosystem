export default function MonogramArt({ monogram, gradient, className = "", ratio = "aspect-[3/4]" }) {
  const [from, to] = gradient;
  return (
    <div
      className={`relative overflow-hidden rounded-sm border border-gold/20 ${ratio} ${className}`}
      style={{
        backgroundImage: `radial-gradient(120% 120% at 20% 15%, ${to}33 0%, transparent 55%), linear-gradient(160deg, ${from} 0%, ${to} 130%)`,
      }}
    >
      <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay [background-image:repeating-linear-gradient(45deg,#fff_0,#fff_1px,transparent_1px,transparent_6px)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-5xl italic tracking-wide text-ivory/90 text-shadow-lg">
          {monogram}
        </span>
      </div>
      <div className="absolute inset-0 border border-white/5 m-2" />
    </div>
  );
}
