// scripts/deployWave1.js — deploys the WAVE 1 (legally clean) contract set.
//
// Wave 1 is everything NOT flagged in README.md's legal-hold list. This
// script only ever touches contracts/wave1/**. It has no code path that can
// reach contracts/wave2/** — see scripts/deployWave2.js for that, which
// carries its own explicit legal-clearance gate.
//
// Testnet (amoy) / local (hardhat): auto-deploys a MockUSDC if USDC_TOKEN
// isn't set, so the whole wave can be verified end-to-end for free.
// Mainnet (polygon): requires USDC_TOKEN to already be a real deployed
// address -- refuses to deploy against a placeholder.
//
// Note: CLARegistry, BountyVault, BlackBusinessRegistry, SusuFactory, and
// InheritanceVault are NOT deployed here -- they already exist as tested
// contracts in contracts/dpc-suite (see that suite's own deploy script).
// Deploying them again here would create a second, competing instance of
// the same product. CompoundForge is also skipped: it structurally depends
// on DPAToken, which lives in wave 2 and isn't deployed until that wave
// clears legal review.

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");

  const isMainnet = network.name === "polygon";
  const d = {};

  // ─── USDC ─────────────────────────────────────────────────────────────────
  let usdcAddress = process.env.USDC_TOKEN;
  if (isMainnet) {
    if (!usdcAddress) throw new Error("USDC_TOKEN must be set to a real USDC address for mainnet");
  } else if (!usdcAddress) {
    console.log("No USDC_TOKEN set -- deploying MockUSDC for testing...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    d.mockUSDC = usdcAddress;
    console.log("  MockUSDC:", usdcAddress, "\n");
  }

  const admin = deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  async function deploy(name, ...args) {
    const Factory = await ethers.getContractFactory(name);
    const c = await Factory.deploy(...args);
    await c.waitForDeployment();
    const addr = await c.getAddress();
    d[name] = addr;
    console.log(`  ${name.padEnd(24)} ${addr}`);
    return c;
  }

  // ─── Tokens ───────────────────────────────────────────────────────────────
  console.log("Tokens");
  const plug = await deploy("PlugToken", treasury, admin);
  const gplug = await deploy("GPlugToken", admin);
  const mft = await deploy("MicroFundToken", admin);
  const gplugConverter = await deploy("GPlugConverter", await plug.getAddress(), await gplug.getAddress(), admin);
  await gplug.grantRole(await gplug.MINTER_ROLE(), await gplugConverter.getAddress());
  await gplug.setTransferAllowlist(await gplugConverter.getAddress(), true);
  console.log();

  // ─── Registry ─────────────────────────────────────────────────────────────
  console.log("Registry");
  const registry = await deploy("PlugRegistry", admin);
  const resolver = await deploy("PlugResolver", await registry.getAddress());
  const registrar = await deploy(
    "PlugRegistrar",
    await registry.getAddress(),
    usdcAddress,
    await plug.getAddress(),
    treasury,
    admin
  );
  await registry.grantRole(await registry.REGISTRAR_ROLE(), await registrar.getAddress());

  const tldOracle = await deploy("TLDValuationOracle", admin);
  const tldPriceController = await deploy("TLDPriceController", await tldOracle.getAddress());
  const tldAuction = await deploy("TLDAuctionEngine", await plug.getAddress(), treasury, admin);
  const userTldRegistry = await deploy("UserTLDRegistry", await plug.getAddress(), treasury, admin);
  const tldRoyalty = await deploy("TLDRoyalty", admin);

  const affiliateTracker = await deploy("AffiliateTracker", await plug.getAddress(), treasury, admin);
  await registrar.setAffiliateTracker(await affiliateTracker.getAddress());
  await affiliateTracker.grantRole(await affiliateTracker.REPORTER_ROLE(), await registrar.getAddress());

  const plugFactory = await deploy(
    "PlugFactory",
    await plug.getAddress(),
    await userTldRegistry.getAddress(),
    treasury,
    admin
  );
  await userTldRegistry.grantRole(await userTldRegistry.ROYALTY_REPORTER_ROLE(), await plugFactory.getAddress());
  console.log();

  // ─── DeFi (wave 1 subset) ─────────────────────────────────────────────────
  console.log("DeFi");
  const forgeVault = await deploy("ForgeVault", admin);
  const insuranceFund = await deploy("InsuranceFund", usdcAddress, 0, admin);
  const familyBankingVault = await deploy("FamilyBankingVault", usdcAddress, admin);

  const aavePool = process.env.AAVE_POOL_ADDRESS;
  if (aavePool) {
    await deploy("FlashLoanArbitrage", aavePool, admin);
  } else {
    console.log("  FlashLoanArbitrage   skipped (set AAVE_POOL_ADDRESS to deploy)");
  }
  console.log();

  // ─── Education ────────────────────────────────────────────────────────────
  console.log("Education");
  await deploy("HomeschoolVault", usdcAddress, admin);
  await deploy("TeacherRetentionFund", usdcAddress, await plug.getAddress(), admin);
  await deploy("EducationVault", usdcAddress, admin);
  console.log();

  // ─── Governance ───────────────────────────────────────────────────────────
  console.log("Governance");
  await deploy("PlugVesting", await plug.getAddress(), admin);
  const multiSigOwners = process.env.MULTISIG_OWNERS
    ? process.env.MULTISIG_OWNERS.split(",")
    : [deployer.address];
  const multiSigThreshold = process.env.MULTISIG_THRESHOLD || 1;
  await deploy("PlugMultiSig", multiSigOwners, multiSigThreshold);

  const timelock = await deploy("PlugTimeLock", 2 * 24 * 60 * 60, [deployer.address], [ethers.ZeroAddress], admin);
  await deploy(
    "PlugGovernance",
    await gplug.getAddress(),
    await timelock.getAddress(),
    1, // votingDelay (blocks) -- tune for target chain block time before mainnet
    45_000, // votingPeriod (blocks) -- ~1 week at 2s/block on Polygon
    0, // proposalThreshold
    4 // quorum %
  );
  console.log();

  // ─── NerdTV ───────────────────────────────────────────────────────────────
  console.log("NerdTV");
  const nerdtvRegistry = await deploy("NerdTVContentRegistry", admin);
  await deploy(
    "NerdTVRoyalty",
    usdcAddress,
    await nerdtvRegistry.getAddress(),
    treasury,
    treasury, // community pool -- point at a real community treasury before mainnet
    admin
  );
  await deploy("WatchToEarn", await plug.getAddress(), treasury, admin);
  console.log();

  // ─── Revenue ──────────────────────────────────────────────────────────────
  console.log("Revenue");
  const aiAccessNft = await deploy(
    "AIAccessNFT",
    usdcAddress,
    await plug.getAddress(),
    treasury,
    await affiliateTracker.getAddress(),
    admin
  );
  await affiliateTracker.grantRole(await affiliateTracker.REPORTER_ROLE(), await aiAccessNft.getAddress());
  await deploy("DataVault", usdcAddress, await plug.getAddress(), await forgeVault.getAddress(), admin);
  await deploy("WhiteLabelLicense", usdcAddress, treasury, admin);
  console.log("  CompoundForge        skipped (depends on wave 2 DPAToken)\n");

  // ─── Misc ─────────────────────────────────────────────────────────────────
  console.log("Misc");
  await deploy("RefugeHousing", usdcAddress, treasury, admin);
  const scoreRegistry = await deploy("ScoreRegistry", admin);
  await deploy("AIAgentGateway", await plug.getAddress(), treasury, admin);
  await deploy("PlugMarketplace", await plug.getAddress(), treasury, admin);
  await deploy("MintingFactory", treasury, admin);
  await deploy("PlugPayments", await resolver.getAddress(), treasury, admin);
  await deploy("FamilyCredit", usdcAddress, ethers.ZeroAddress, admin);
  console.log(
    "  TokenBoundAccount    skipped (one instance is deployed per bound NFT, not part of a fleet deploy)"
  );
  console.log();

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  WAVE 1 DEPLOYMENT COMPLETE —", network.name);
  console.log("═══════════════════════════════════════════════════════");
  Object.entries(d).forEach(([name, addr]) => console.log(`  ${name.padEnd(24)} ${addr}`));
  console.log("═══════════════════════════════════════════════════════");

  const outDir = path.join(__dirname, "..", "deployments", network.name);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "wave1.json"), JSON.stringify(d, null, 2));
  console.log(`\nAddresses saved to deployments/${network.name}/wave1.json`);
  console.log("Next: verify on Polygonscan with `npx hardhat verify`, then move admin roles");
  console.log("to PlugTimeLock/PlugMultiSig before handling real value.");

  return d;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
