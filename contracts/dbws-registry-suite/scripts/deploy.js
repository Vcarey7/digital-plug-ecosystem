/* eslint-disable no-console */
// scripts/deploy.js — deploys the six DBWS registries + RevenueRouter.
//
// NoteRegistry ($DPNOTE — the private-credit/revenue-participation note
// ledger) carries a separate legal-review gate on top of the normal
// testnet-then-mainnet flow: fixed-yield notes and revenue-participation
// notes sold to investors are a securities question (Reg D/Reg CF
// territory), independent of whether a human has signed off on this
// deployment in general. On Polygon mainnet this script refuses to deploy
// NoteRegistry unless NOTE_REGISTRY_LEGAL_CLEARANCE is set to the exact
// literal phrase below -- set that only after a securities attorney has
// actually cleared the product, not before. The other five registries and
// RevenueRouter are unaffected and deploy normally.
const NOTE_REGISTRY_CLEARANCE_PHRASE = "LEGAL_CLEARED_FOR_MAINNET";

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || admin;
  const isMainnet = network.name === "polygon";

  console.log("DBWS Registry Suite — deploying six registries + RevenueRouter");
  console.log("Deployer:", admin);
  console.log("Treasury:", treasury);
  console.log("Network :", network.name);
  console.log("──────────────────────────────────────────────");

  // ─── USDC ─────────────────────────────────────────────────────────────────
  let usdcAddress = process.env.USDC_ADDRESS;
  if (isMainnet) {
    if (!usdcAddress) throw new Error("USDC_ADDRESS must be set to a real USDC address for mainnet");
  } else if (!usdcAddress) {
    console.log("No USDC_ADDRESS set -- deploying MockUSDC for testing...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("  MockUSDC:", usdcAddress, "\n");
  }

  const addr = {};
  async function deploy(name, args = []) {
    const F = await ethers.getContractFactory(name);
    const c = await F.deploy(...args);
    await c.waitForDeployment();
    addr[name] = await c.getAddress();
    console.log(`✓ ${name.padEnd(20)} ${addr[name]}`);
    return c;
  }

  // Shared fee sink first — every registry points at it.
  const router = await deploy("RevenueRouter", [treasury, usdcAddress, admin]);

  // Five fee-charging registries.
  const plug = await deploy("PlugRegistry", [addr.RevenueRouter, usdcAddress, admin]);
  await deploy("EntityRegistry", [addr.RevenueRouter, usdcAddress, admin]);
  await deploy("IPRegistry", [addr.RevenueRouter, usdcAddress, admin]);
  await deploy("LicenseRegistry", [addr.RevenueRouter, usdcAddress, admin]);
  await deploy("CommunityRegistry", [addr.RevenueRouter, usdcAddress, admin]);

  // NoteRegistry ($DPNOTE) — legal-hold gate on mainnet only.
  if (isMainnet && process.env.NOTE_REGISTRY_LEGAL_CLEARANCE !== NOTE_REGISTRY_CLEARANCE_PHRASE) {
    console.log("⚠ NoteRegistry SKIPPED — legal hold. $DPNOTE (fixed-yield / revenue-");
    console.log("  participation notes) is a securities question independent of this");
    console.log("  deploy's human go-ahead. Set NOTE_REGISTRY_LEGAL_CLEARANCE=" + NOTE_REGISTRY_CLEARANCE_PHRASE);
    console.log("  in .env only after an attorney has actually cleared the product.");
  } else {
    await deploy("NoteRegistry", [admin]); // ledger only, no router
    if (isMainnet) console.log("⚠ NOTE_REGISTRY_LEGAL_CLEARANCE confirmed -- NoteRegistry deployed to mainnet.");
  }

  // Seed a few flagship TLDs so the registry is usable immediately (the
  // full 246-TLD catalog is Phase 2b, scripts/seedTLDs.js). Fees are USDC,
  // 6 decimals.
  const T1 = 97_000_000n;   // $97/yr
  const XFER1 = 25_000_000n; // $25 transfer
  for (const tld of ["plug", "dbws", "sovereign", "wall", "black"]) {
    await (await plug.configureTLD(tld, T1, XFER1, true)).wait();
    console.log(`   ↳ configured .${tld}`);
  }

  const net = await ethers.provider.getNetwork();
  const out = {
    network: network.name,
    chainId: Number(net.chainId),
    deployer: admin,
    treasury,
    usdc: usdcAddress,
    deployedAt: new Date().toISOString(),
    contracts: addr,
  };
  const dir = path.join(__dirname, "..", "deployments", network.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "addresses.json"), JSON.stringify(addr, null, 2));
  fs.writeFileSync(path.join(dir, "deployment.json"), JSON.stringify(out, null, 2));

  console.log("──────────────────────────────────────────────");
  console.log(`Saved → deployments/${network.name}/`);
  console.log("Next: seed the full TLD catalog (scripts/seedTLDs.js) and verify on Polygonscan.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
