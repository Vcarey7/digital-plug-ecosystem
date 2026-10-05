/* eslint-disable no-console */
/**
 * seedTLDs.js — configures every TLD from the catalog into the deployed
 * PlugRegistry via configureTLD(tld, feePerYear, transferFee, enabled).
 * Prices are USDC (6 decimals). Run after Phase 1 deploy (and after the
 * Phase 2a USDC conversion, since fees are USDC-denominated here).
 *
 *   npx hardhat run scripts/seedTLDs.js --network amoy
 *
 * Reads deployments/<network>/addresses.json for PlugRegistry and the TLD
 * list from tld/catalog.js. Idempotent: re-running just re-sets prices.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { SEED_LIST } = require("../tld/catalog");

// ── USDC tier pricing (6 decimals) ──────────────────────────────────────────
// Registration fee per YEAR, and one-time secondary transfer fee, by tier.
// Tier index: 0 LEGENDARY · 1 GOLD · 2 STANDARD · 3 STARTER
const USDC = (n) => BigInt(Math.round(n * 1e6));
const TIER_PRICE = {
  0: { reg: USDC(497), xfer: USDC(99) }, // LEGENDARY
  1: { reg: USDC(197), xfer: USDC(49) }, // GOLD
  2: { reg: USDC(97),  xfer: USDC(25) }, // STANDARD
  3: { reg: USDC(29),  xfer: USDC(9)  }, // STARTER
};

const BATCH = 20; // configureTLD calls are individual txs; batch for logging

async function main() {
  const dir = path.join(__dirname, "..", "deployments", network.name);
  const addrPath = path.join(dir, "addresses.json");
  if (!fs.existsSync(addrPath)) {
    throw new Error(`No addresses.json for ${network.name}. Deploy Phase 1 first.`);
  }
  const addr = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  const plug = await ethers.getContractAt("PlugRegistry", addr.PlugRegistry);

  console.log(`Seeding ${SEED_LIST.length} TLDs into PlugRegistry on ${network.name}`);
  console.log("PlugRegistry:", addr.PlugRegistry);
  console.log("──────────────────────────────────────────────");

  let done = 0;
  let reservedDisabled = 0;

  for (let i = 0; i < SEED_LIST.length; i += BATCH) {
    const slice = SEED_LIST.slice(i, i + BATCH);
    for (const e of slice) {
      const price = TIER_PRICE[e.tier] || TIER_PRICE[2];
      // Reserved (protocol-held) TLDs are listed but DISABLED for public
      // registration — admin mints under them separately.
      const enabled = !e.reserved;
      if (!enabled) reservedDisabled++;
      const tx = await plug.configureTLD(e.tld, price.reg, price.xfer, enabled);
      await tx.wait();
      done++;
    }
    console.log(`  configured ${done}/${SEED_LIST.length}...`);
  }

  const manifest = {
    network: network.name,
    plugRegistry: addr.PlugRegistry,
    seededAt: new Date().toISOString(),
    priceUnit: "USDC (6 decimals)",
    tierPricing: {
      LEGENDARY: "497/yr, 99 transfer",
      GOLD: "197/yr, 49 transfer",
      STANDARD: "97/yr, 25 transfer",
      STARTER: "29/yr, 9 transfer",
    },
    totalTLDs: SEED_LIST.length,
    reservedDisabled,
    tlds: SEED_LIST.map((e) => ({
      tld: e.tld,
      tier: ["LEGENDARY", "GOLD", "STANDARD", "STARTER"][e.tier],
      reserved: e.reserved,
      enabled: !e.reserved,
    })),
  };
  fs.writeFileSync(path.join(dir, "tld-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("──────────────────────────────────────────────");
  console.log(`Configured : ${done} TLDs`);
  console.log(`Reserved (listed but disabled for public): ${reservedDisabled}`);
  console.log(`Manifest → deployments/${network.name}/tld-manifest.json`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
