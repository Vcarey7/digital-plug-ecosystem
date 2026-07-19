export const CATEGORIES = ["Éditorial", "Riviera", "Noir", "Couture", "Ingénue"];

export const PERSONAS = [
  {
    id: "aurelia-vane",
    name: "Aurelia Vane",
    house: "Atelier Vane",
    category: "Éditorial",
    monogram: "AV",
    gradient: ["#3a2e39", "#c9a769"],
    tagline: "Warm-lit editorial muse with a quiet, expensive confidence.",
    backstory:
      "Aurelia reads like the last page of a fashion month spread — unhurried, sun-warmed, deliberate. Built for brands that want stillness to feel like status.",
    tags: ["high-fashion", "warm-tone", "minimalist"],
    rating: 4.9,
    reviews: 132,
    licenses: {
      exclusive: { price: 4800, available: true },
      shared: { price: 620, licensedCount: 11 },
    },
    contentPacks: [
      {
        id: "av-riviera-edit",
        title: "The Riviera Edit",
        mediaCount: 42,
        price: 180,
        description: "A sun-drenched coastal set — resortwear, terraces, gold hour.",
      },
      {
        id: "av-studio-portraits",
        title: "Studio Portrait Series",
        mediaCount: 24,
        price: 110,
        description: "Clean studio portraiture, neutral backdrops, tailoring-forward.",
      },
    ],
  },
  {
    id: "seraphine-cole",
    name: "Séraphine Cole",
    house: "Maison Cole",
    category: "Noir",
    monogram: "SC",
    gradient: ["#141018", "#5c1a2b"],
    tagline: "Low-light, high-contrast. A muse for after-dark storytelling.",
    backstory:
      "Séraphine lives in shadow and candlelight. Cast for brands that want restraint, mystery, and a single striking frame rather than a hundred loud ones.",
    tags: ["noir", "moody", "cinematic"],
    rating: 4.8,
    reviews: 97,
    licenses: {
      exclusive: { price: 5200, available: true },
      shared: { price: 690, licensedCount: 7 },
    },
    contentPacks: [
      {
        id: "sc-after-hours",
        title: "After Hours",
        mediaCount: 30,
        price: 160,
        description: "Candlelit interiors, velvet and smoke, minimal palette.",
      },
    ],
  },
  {
    id: "valentina-rey",
    name: "Valentina Rey",
    house: "Studio Rey",
    category: "Riviera",
    monogram: "VR",
    gradient: ["#123a3a", "#cda86a"],
    tagline: "Coastal glamour with an old-money finish.",
    backstory:
      "Valentina belongs on a yacht deck or a marble terrace. Designed for lifestyle and travel-adjacent brands leaning into quiet luxury.",
    tags: ["resort", "old-money", "sun-kissed"],
    rating: 4.7,
    reviews: 64,
    licenses: {
      exclusive: { price: 4200, available: false },
      shared: { price: 540, licensedCount: 19 },
    },
    contentPacks: [
      {
        id: "vr-amalfi",
        title: "Amalfi Mornings",
        mediaCount: 36,
        price: 150,
        description: "Coastal terraces, linen, espresso — early-light tones.",
      },
      {
        id: "vr-yacht-club",
        title: "Yacht Club",
        mediaCount: 20,
        price: 95,
        description: "Deckwear and marina backdrops, crisp whites and navy.",
      },
    ],
  },
  {
    id: "odessa-marchetti",
    name: "Odessa Marchetti",
    house: "Maison Marchetti",
    category: "Couture",
    monogram: "OM",
    gradient: ["#1b1024", "#8a5fb0"],
    tagline: "Runway-built. Structured silhouettes, sculptural posing.",
    backstory:
      "Odessa was designed frame-by-frame off couture runway references — precise posture, architectural styling. A muse for brands selling craft, not casualness.",
    tags: ["couture", "structured", "runway"],
    rating: 5.0,
    reviews: 41,
    licenses: {
      exclusive: { price: 6100, available: true },
      shared: { price: 780, licensedCount: 3 },
    },
    contentPacks: [
      {
        id: "om-atelier-line",
        title: "Atelier Line",
        mediaCount: 28,
        price: 200,
        description: "Sculptural silhouettes against raw concrete and steel.",
      },
    ],
  },
  {
    id: "colette-duvall",
    name: "Colette Duvall",
    house: "Studio Duvall",
    category: "Ingénue",
    monogram: "CD",
    gradient: ["#241a12", "#d9b45b"],
    tagline: "Soft, disarming, effortlessly warm — the girl-next-door with taste.",
    backstory:
      "Colette trades drama for warmth. Cast for brands wanting approachable elegance rather than untouchable glamour.",
    tags: ["soft-glam", "approachable", "natural-light"],
    rating: 4.6,
    reviews: 88,
    licenses: {
      exclusive: { price: 3600, available: true },
      shared: { price: 460, licensedCount: 26 },
    },
    contentPacks: [
      {
        id: "cd-golden-hour",
        title: "Golden Hour Diaries",
        mediaCount: 33,
        price: 120,
        description: "Natural light, candid framing, warm neutrals.",
      },
    ],
  },
  {
    id: "ines-larkspur",
    name: "Inès Larkspur",
    house: "Atelier Larkspur",
    category: "Éditorial",
    monogram: "IL",
    gradient: ["#0f1620", "#7d97b3"],
    tagline: "Cool-toned, angular, unmistakably Parisian.",
    backstory:
      "Inès is precision over warmth — sharp lines, monochrome wardrobes, gallery-white backdrops. Built for brands with a design-forward point of view.",
    tags: ["parisian", "cool-tone", "gallery"],
    rating: 4.8,
    reviews: 55,
    licenses: {
      exclusive: { price: 4500, available: true },
      shared: { price: 590, licensedCount: 9 },
    },
    contentPacks: [
      {
        id: "il-rive-gauche",
        title: "Rive Gauche",
        mediaCount: 26,
        price: 135,
        description: "Monochrome tailoring against Left Bank architecture.",
      },
    ],
  },
  {
    id: "marlowe-sinclair",
    name: "Marlowe Sinclair",
    house: "Maison Sinclair",
    category: "Noir",
    monogram: "MS",
    gradient: ["#1a1414", "#7a2e2e"],
    tagline: "Sharp jawline energy. Confident, a little dangerous.",
    backstory:
      "Marlowe was built for brands wanting edge without chaos — tailored menswear-inspired silhouettes, deep reds, low-key lighting.",
    tags: ["tailored", "edge", "low-key"],
    rating: 4.7,
    reviews: 39,
    licenses: {
      exclusive: { price: 4300, available: true },
      shared: { price: 560, licensedCount: 5 },
    },
    contentPacks: [
      {
        id: "ms-crimson-room",
        title: "Crimson Room",
        mediaCount: 22,
        price: 130,
        description: "Deep-red interiors, tailored silhouettes, single-source light.",
      },
    ],
  },
  {
    id: "bianca-thorne",
    name: "Bianca Thorne",
    house: "Studio Thorne",
    category: "Couture",
    monogram: "BT",
    gradient: ["#132420", "#4fae94"],
    tagline: "Emerald-toned drama for statement campaigns.",
    backstory:
      "Bianca is the closing look of the show — bold color, full-length silhouettes, unapologetic presence. Built for launch-moment campaigns.",
    tags: ["statement", "campaign-ready", "color-forward"],
    rating: 4.9,
    reviews: 28,
    licenses: {
      exclusive: { price: 5500, available: true },
      shared: { price: 710, licensedCount: 2 },
    },
    contentPacks: [
      {
        id: "bt-emerald-hour",
        title: "Emerald Hour",
        mediaCount: 25,
        price: 165,
        description: "Jewel-tone campaign set, single statement color story.",
      },
    ],
  },
];

export const findPersona = (id) => PERSONAS.find((p) => p.id === id);
