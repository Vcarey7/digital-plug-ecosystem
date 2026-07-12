/* eslint-disable no-console */
/**
 * seedTLDs.js — lists the full DBWS TLD catalog into TLDCatalog and mints
 * each into UserTLDRegistry (protocol inventory). Run after deployWave1.js.
 *
 *   npx hardhat run scripts/seedTLDs.js --network amoy
 *
 * Reads deployed addresses from deployments/<network>/wave1.json and the TLD
 * list from tld/catalog.js. Batches to keep gas bounded. Idempotent:
 * TLDCatalog.batchListTLD skips already-listed names, and minting is wrapped
 * so already-minted names don't abort the run.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { CATALOG, SEED_LIST } = require("../tld/catalog");

const CATEGORY_LABEL = {};
for (const [label, section] of Object.entries(CATALOG)) {
  for (const tld of section.tlds) CATEGORY_LABEL[tld.toLowerCase()] = label;
}

const BATCH = 25; // TLDs per tx

async function main() {
  const dir = path.join(__dirname, "..", "deployments", network.name);
  const addrPath = path.join(dir, "wave1.json");
  if (!fs.existsSync(addrPath)) {
    throw new Error(`No wave1.json for ${network.name}. Run scripts/deployWave1.js first.`);
  }
  const addr = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  if (!addr.TLDCatalog || !addr.UserTLDRegistry) {
    throw new Error("wave1.json is missing TLDCatalog / UserTLDRegistry addresses.");
  }

  const catalog = await ethers.getContractAt("TLDCatalog", addr.TLDCatalog);
  const userTld = await ethers.getContractAt("UserTLDRegistry", addr.UserTLDRegistry);

  console.log(`Seeding ${SEED_LIST.length} TLDs on ${network.name}`);
  console.log("TLDCatalog     :", addr.TLDCatalog);
  console.log("UserTLDRegistry:", addr.UserTLDRegistry);
  console.log("──────────────────────────────────────────────");

  // ── 1. List into TLDCatalog in batches ──────────────────────────────────
  for (let i = 0; i < SEED_LIST.length; i += BATCH) {
    const slice = SEED_LIST.slice(i, i + BATCH);
    const tlds = slice.map((e) => e.tld);
    const tiers = slice.map((e) => e.tier);
    const cats = slice.map((e) => CATEGORY_LABEL[e.tld] || "expansion");
    const reserved = slice.map((e) => e.reserved);
    const tx = await catalog.batchListTLD(tlds, tiers, cats, reserved);
    await tx.wait();
    console.log(`  catalog.batchListTLD  [${i}..${i + slice.length - 1}]  ✓`);
  }

  // ── 2. Mint protocol inventory into UserTLDRegistry ─────────────────────
  const [deployer] = await ethers.getSigners();
  const to = process.env.TREASURY_ADDRESS || deployer.address;
  let minted = 0;
  let skipped = 0;

  for (const e of SEED_LIST) {
    try {
      const available = await userTld.isTLDAvailable(e.tld);
      if (!available) { skipped++; continue; }
      // royaltyBps: use catalog subdomain cut for the tier (owner is protocol).
      const cut = await catalog.subdomainCutBpsOf(e.tld);
      const tx = await userTld.adminMintTLD(to, e.tld, cut);
      await tx.wait();
      await (await catalog.setMintedFlag(e.tld, true)).wait();
      minted++;
      if (minted % 20 === 0) console.log(`  minted ${minted} TLDs...`);
    } catch (err) {
      skipped++;
      console.log(`  skip .${e.tld} (${(err.reason || err.message || "").slice(0, 40)})`);
    }
  }

  // ── 3. Write a manifest artifact ────────────────────────────────────────
  const manifest = {
    network: network.name,
    catalogAddress: addr.TLDCatalog,
    userTLDRegistry: addr.UserTLDRegistry,
    seededAt: new Date().toISOString(),
    totalTLDs: SEED_LIST.length,
    minted,
    skipped,
    reservedCount: SEED_LIST.filter((e) => e.reserved).length,
    tlds: SEED_LIST.map((e) => ({
      tld: e.tld,
      tier: ["LEGENDARY", "GOLD", "STANDARD", "STARTER"][e.tier],
      category: CATEGORY_LABEL[e.tld] || "expansion",
      reserved: e.reserved,
    })),
  };
  fs.writeFileSync(path.join(dir, "tld-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("──────────────────────────────────────────────");
  console.log(`Listed in catalog : ${SEED_LIST.length}`);
  console.log(`Minted to registry: ${minted}`);
  console.log(`Skipped           : ${skipped}`);
  console.log(`Manifest → deployments/${network.name}/tld-manifest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
