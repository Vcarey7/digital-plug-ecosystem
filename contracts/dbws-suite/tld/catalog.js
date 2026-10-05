/**
 * DBWS PLUG REGISTRY — MASTER TLD CATALOG
 * Digital Plug Co. · UserTLDRegistry seed data
 *
 * Tier model (from registry design sessions):
 *   LEGENDARY (0) — mint 500 PLUG · 5% subdomain cut  · $100/yr renewal
 *   GOLD      (1) — mint 250 PLUG · 8% subdomain cut  · $75/yr  renewal
 *   STANDARD  (2) — mint 100 PLUG · 10% subdomain cut · $50/yr  renewal
 *   STARTER   (3) — mint 25 PLUG  · 15% subdomain cut · $25/yr  renewal
 *
 * royaltyBps below = the TLD owner's cut on subdomain sales for protocol
 * inventory TLDs (Digital Plug keeps these), expressed in basis points.
 *
 * NOTE: This is the consolidated inventory reconstructed from DBWS registry
 * sessions. Confirmed names are included verbatim; where the historical
 * "160" list included names not individually recorded in our sessions, add
 * them to the EXPANSION array at the bottom before seeding. Duplicates are
 * removed automatically by the seed script.
 */

const TIER = { LEGENDARY: 0, GOLD: 1, STANDARD: 2, STARTER: 3 };

// Default owner-royalty on subdomains for protocol TLDs (10%).
const R = 1000;

const CATALOG = {
  // ── SECTION 1 · DBWS ECOSYSTEM / FLAGSHIP (reserved 🔒) ──────────────────
  flagship: {
    tier: TIER.LEGENDARY,
    reserved: true,
    tlds: [
      "plug", "dbws", "wall", "vault", "bank", "capital", "defi",
      "wealth", "family", "legacy", "greenwood", "blackwallstreet",
      "sovereign", "digitalplug",
    ],
  },

  // ── SECTION 2 · .PLUG ECOSYSTEM VARIANTS ────────────────────────────────
  plugEcosystem: {
    tier: TIER.GOLD,
    reserved: false,
    tlds: [
      "agentplug", "gptplug", "sellplug", "coinplug", "vaultplug",
      "chainplug", "storeplug", "brandplug", "legalplug", "fundplug",
      "pluggers", "plugged", "replug", "brainplug", "hackplug",
      "nodeplug", "swapplug", "buildplug", "toysplug",
    ],
  },

  // ── SECTION 3 · MUSIC & ARTIST COMMUNITY ────────────────────────────────
  music: {
    tier: TIER.GOLD,
    reserved: false,
    tlds: [
      "emcee", "hiphop", "rap", "bars", "freestyle", "cipher", "mixtape",
      "boom", "trap", "drill", "rnb", "soul", "rhythm", "vocals", "harmony",
      "groove", "beats", "producer", "studio", "track", "drop", "vinyl",
      "sound", "audio", "lyrics", "melody", "sample", "remix", "acoustic",
      "amplify", "music",
    ],
  },

  // ── SECTION 4 · BLACK CULTURE & HERITAGE ────────────────────────────────
  culture: {
    tier: TIER.GOLD,
    reserved: false,
    tlds: [
      "bukaiju", "roots", "heritage", "culture", "diaspora", "afro",
      "ubuntu", "melanin", "kingdom", "tribe", "village", "collective",
      "movement", "power", "unity", "rise", "dynasty", "empire", "crown",
      "throne",
    ],
  },

  // ── SECTION 5 · AI / AGENT NAMESPACE ────────────────────────────────────
  agent: {
    tier: TIER.GOLD,
    reserved: false,
    tlds: [
      "agent", "gpt", "ai", "neural", "clone", "bot", "assistant",
      "prompt", "model", "inference",
    ],
  },

  // ── SECTION 6 · FINANCE / DEFI ──────────────────────────────────────────
  finance: {
    tier: TIER.GOLD,
    reserved: false,
    tlds: [
      "finance", "wallet", "trade", "coin", "token", "stake", "yield",
      "lend", "credit", "invest", "fund", "money", "cash", "pay",
      "escrow", "ledger", "treasury", "fortune", "treasure",
    ],
  },

  // ── SECTION 7 · COMMERCE / BUSINESS ─────────────────────────────────────
  commerce: {
    tier: TIER.STANDARD,
    reserved: false,
    tlds: [
      "store", "shop", "market", "brand", "biz", "enterprise", "company",
      "startup", "venture", "deal", "sale", "buy", "sell", "commerce",
      "retail", "wholesale",
    ],
  },

  // ── SECTION 8 · MEDIA / NERDTV ──────────────────────────────────────────
  media: {
    tier: TIER.STANDARD,
    reserved: false,
    tlds: [
      "stream", "tv", "watch", "media", "channel", "show", "series",
      "podcast", "radio", "live", "broadcast", "nerdtv", "glitch",
    ],
  },

  // ── SECTION 9 · REAL ESTATE / HOUSING ───────────────────────────────────
  housing: {
    tier: TIER.STANDARD,
    reserved: false,
    tlds: [
      "home", "house", "estate", "property", "realty", "land", "build",
      "refuge", "shelter", "haven", "dwelling",
    ],
  },

  // ── SECTION 10 · GEOGRAPHIC / CULTURAL RESERVE (reserved 🔒) ─────────────
  geographic: {
    tier: TIER.LEGENDARY,
    reserved: true,
    tlds: [
      "newburgh", "manhattan", "beverlyhills", "mayfair", "zurich",
      "cayman", "singapore", "dubai", "monaco", "geneva", "luxembourg",
      "bahamas", "bermuda", "swiss", "tokyo", "hongkong",
    ],
  },

  // ── SECTION 11 · EXIT / PRESTIGE ENHANCERS ──────────────────────────────
  prestige: {
    tier: TIER.LEGENDARY,
    reserved: false,
    tlds: [
      "platinum", "diamond", "gold", "elite", "exclusive", "royal",
      "luxe", "lux", "prestige", "prime", "apex", "summit",
    ],
  },

  // ── SECTION 12 · UTILITY / VOLUME ───────────────────────────────────────
  utility: {
    tier: TIER.STARTER,
    reserved: false,
    tlds: [
      "flex", "hub", "app", "dev", "online", "site", "web", "net",
      "link", "id", "me", "my", "pro", "plus", "go", "now",
    ],
  },

  // ── SECTION 13 · CAREY FAMILY / PERSONAS (reserved 🔒) ───────────────────
  careyFamily: {
    tier: TIER.LEGENDARY,
    reserved: true,
    tlds: [
      "carey", "careymaison", "creed", "viccreed", "jihad", "redijedi",
      "sinemacula", "wallcrest", "epochdemic",
    ],
  },
};

/**
 * EXPANSION — drop any additional confirmed TLD strings here to reach the
 * full historical 160+ count. They mint as STANDARD/non-reserved unless you
 * move them into a category above. Deduped against everything else at seed.
 */
const EXPANSION = [
  "xyz", "verse", "nova", "art", "nft", "myname", "fanclub", "sports",
  "game", "arcade", "play", "win", "fit", "health", "wellness", "food",
  "eat", "drink", "travel", "world", "earth", "space", "future", "tech",
  "code", "data", "cloud", "secure", "guard", "trust", "law", "legal",
  "tax", "audit", "cpa", "school", "learn", "academy", "class", "teach",
];

// ── Flatten to a seed list: [{ tld, tier, royaltyBps, reserved }] ─────────
function buildSeedList() {
  const seen = new Set();
  const out = [];
  for (const section of Object.values(CATALOG)) {
    for (const tld of section.tlds) {
      const key = tld.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ tld: key, tier: section.tier, royaltyBps: R, reserved: section.reserved });
    }
  }
  for (const tld of EXPANSION) {
    const key = tld.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tld: key, tier: TIER.STANDARD, royaltyBps: R, reserved: false });
  }
  return out;
}

const SEED_LIST = buildSeedList();

module.exports = { TIER, CATALOG, EXPANSION, SEED_LIST, buildSeedList };

// Allow: `node tld/catalog.js` to print counts.
if (require.main === module) {
  const byTier = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let reserved = 0;
  for (const e of SEED_LIST) { byTier[e.tier]++; if (e.reserved) reserved++; }
  console.log(`Total unique TLDs: ${SEED_LIST.length}`);
  console.log(`  Legendary: ${byTier[0]}  Gold: ${byTier[1]}  Standard: ${byTier[2]}  Starter: ${byTier[3]}`);
  console.log(`  Reserved (protocol-held): ${reserved}`);
}
