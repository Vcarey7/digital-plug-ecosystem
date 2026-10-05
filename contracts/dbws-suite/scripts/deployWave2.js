// scripts/deployWave2.js — deploys the WAVE 2 (legally gated) contract set.
//
// Every contract this script touches lives under contracts/wave2/** and
// carries a "WAVE 2 — HOLD FOR LEGAL REVIEW" banner in its source explaining
// exactly what needs clearing (securities/Howey, CFTC/state gambling, or
// lending-license/usury -- see README.md for the full breakdown per
// contract). Building and testing these is fine; putting them in front of
// real users and real money on mainnet is not, until the specific licensing
// partnership or legal sign-off referenced in that banner is actually in
// place.
//
// On amoy/local this script runs freely -- that's just verifying the code
// works, not launching a product.
//
// On polygon (mainnet) this script refuses to run AT ALL unless
// WAVE2_LEGAL_CLEARANCE is set to the exact literal string below. This is
// not a technical safeguard against a determined operator -- it's a
// deliberate speed bump so "wave 2" can never ship by accident (wrong
// script, copy-pasted command, muscle memory from wave 1). Do not set this
// value until a securities/gaming/lending attorney has actually reviewed
// and cleared the specific contracts you are about to deploy.

const REQUIRED_CLEARANCE_PHRASE = "LEGAL_CLEARED_FOR_MAINNET";

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const isMainnet = network.name === "polygon";
  if (isMainnet && process.env.WAVE2_LEGAL_CLEARANCE !== REQUIRED_CLEARANCE_PHRASE) {
    throw new Error(
      "Refusing to deploy WAVE 2 contracts to mainnet.\n" +
        "These contracts are on legal hold (securities / CFTC / lending-license review --\n" +
        "see README.md). Set WAVE2_LEGAL_CLEARANCE=" +
        REQUIRED_CLEARANCE_PHRASE +
        " in your .env\n" +
        "ONLY after an attorney has actually cleared the specific contracts you're deploying."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");
  if (isMainnet) {
    console.log("⚠ WAVE2_LEGAL_CLEARANCE confirmed -- proceeding with mainnet deploy of gated contracts.\n");
  }

  let usdcAddress = process.env.USDC_TOKEN;
  if (isMainnet) {
    if (!usdcAddress) throw new Error("USDC_TOKEN must be set to a real USDC address for mainnet");
  } else if (!usdcAddress) {
    console.log("No USDC_TOKEN set -- deploying MockUSDC for testing...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("  MockUSDC:", usdcAddress, "\n");
  }

  // Wave 1 addresses (PLUG, GPLUG, ForgeVault, InsuranceFund) are required --
  // wave 2 contracts wire into them. Point at the saved wave1.json, or set
  // these explicitly via env for a mainnet deploy.
  const wave1File = path.join(__dirname, "..", "deployments", network.name, "wave1.json");
  const wave1 = fs.existsSync(wave1File) ? JSON.parse(fs.readFileSync(wave1File, "utf8")) : {};

  const plugAddress = process.env.PLUG_TOKEN || wave1.PlugToken;
  const gplugAddress = process.env.GPLUG_TOKEN || wave1.GPlugToken;
  const forgeVaultAddress = process.env.FORGE_VAULT || wave1.ForgeVault;
  const insuranceFundAddress = process.env.INSURANCE_FUND || wave1.InsuranceFund;
  if (!plugAddress || !gplugAddress || !forgeVaultAddress || !insuranceFundAddress) {
    throw new Error(
      "Missing wave 1 dependency addresses. Run scripts/deployWave1.js first (or set " +
        "PLUG_TOKEN / GPLUG_TOKEN / FORGE_VAULT / INSURANCE_FUND explicitly)."
    );
  }

  const admin = deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const d = {};

  async function deploy(name, ...args) {
    const Factory = await ethers.getContractFactory(name);
    const c = await Factory.deploy(...args);
    await c.waitForDeployment();
    const addr = await c.getAddress();
    d[name] = addr;
    console.log(`  ${name.padEnd(24)} ${addr}`);
    return c;
  }

  console.log("Community finance (Howey-flagged)");
  const bond = await deploy("BlockBondNFT", usdcAddress, admin);
  const revenuePool = await deploy("CommunityRevenuePool", usdcAddress, await bond.getAddress(), admin);
  await bond.setRevenuePool(await revenuePool.getAddress());
  const credit = await deploy("CommunityCredit", usdcAddress, treasury, admin);
  await bond.setCredit(await credit.getAddress());
  await credit.grantRole(await credit.REPORTER_ROLE(), await bond.getAddress());
  console.log();

  console.log("Forge cluster (Howey gray area)");
  const dpa = await deploy("DPAToken", process.env.DPA_BASE_URI || "ipfs://dpa/", admin);
  const absorptionFund = await deploy("AbsorptionFund", plugAddress, usdcAddress, admin);
  const forgeCore = await deploy(
    "ForgeCore",
    plugAddress,
    usdcAddress,
    await dpa.getAddress(),
    forgeVaultAddress,
    insuranceFundAddress,
    await absorptionFund.getAddress(),
    admin
  );
  await dpa.grantRole(await dpa.MINTER_ROLE(), await forgeCore.getAddress());
  console.log();

  console.log("Savings / RWA (Howey)");
  await deploy("SavingsVault", usdcAddress, admin);
  await deploy("RWAVault", usdcAddress, process.env.RWA_BASE_URI || "ipfs://rwa/", admin);
  console.log();

  console.log("Prediction markets (CFTC / gambling)");
  const predictionMarket = await deploy("PredictionMarket", gplugAddress, plugAddress, treasury, admin);
  const predictionOracle = await deploy("PredictionOracle", await predictionMarket.getAddress(), admin);
  await predictionMarket.grantRole(await predictionMarket.ORACLE_ROLE(), await predictionOracle.getAddress());
  console.log();

  console.log("Staking / factoring / tournaments (securities / skill-gaming)");
  await deploy("PlugStaking", plugAddress, admin);
  await deploy("InvoiceToken", usdcAddress, admin);
  await deploy("TournamentPrizePool", treasury, admin);
  console.log();

  console.log("Bridge (money-transmission)");
  await deploy("PlugBridge", plugAddress, admin);
  console.log();

  console.log("═══════════════════════════════════════════════════════");
  console.log("  WAVE 2 DEPLOYMENT COMPLETE —", network.name);
  console.log("═══════════════════════════════════════════════════════");
  Object.entries(d).forEach(([name, addr]) => console.log(`  ${name.padEnd(24)} ${addr}`));
  console.log("═══════════════════════════════════════════════════════");

  const outDir = path.join(__dirname, "..", "deployments", network.name);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "wave2.json"), JSON.stringify(d, null, 2));
  console.log(`\nAddresses saved to deployments/${network.name}/wave2.json`);
  if (!isMainnet) {
    console.log("\nThis was a testnet/local deploy -- fine for verification. Do NOT market these");
    console.log("contracts or route real user funds through them until legal review clears each one.");
  }

  return d;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
