// deploy/deploy_all.js — Hardhat deployment script for the Digital Plug contract suite
//
// Testnet (amoy) / local (hardhat): auto-deploys mock $PLUG and USDC tokens
// if PLUG_TOKEN / USDC_TOKEN aren't set, so the whole suite can be verified
// end-to-end for free.
//
// Mainnet (polygon): requires PLUG_TOKEN and USDC_TOKEN to already be set to
// real deployed token addresses -- refuses to deploy against a placeholder.

const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name);
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");

  const isMainnet = network.name === "polygon";
  const deployed = {};

  // ─── 0. Tokens ─────────────────────────────────────────────────────────────
  let plugTokenAddress = process.env.PLUG_TOKEN;
  let usdcTokenAddress = process.env.USDC_TOKEN;

  if (isMainnet) {
    if (!plugTokenAddress) throw new Error("PLUG_TOKEN must be set to a real deployed $PLUG address for mainnet");
    if (!usdcTokenAddress) throw new Error("USDC_TOKEN must be set to a real USDC address for mainnet");
  } else {
    if (!plugTokenAddress) {
      console.log("0/8  No PLUG_TOKEN set -- deploying MockPlugToken for testing...");
      const MockPlugToken = await ethers.getContractFactory("MockPlugToken");
      const mockPlug = await MockPlugToken.deploy();
      await mockPlug.waitForDeployment();
      plugTokenAddress = await mockPlug.getAddress();
      deployed.mockPlugToken = plugTokenAddress;
      console.log("     MockPlugToken:       ", plugTokenAddress);
    }
    if (!usdcTokenAddress) {
      console.log("     No USDC_TOKEN set -- deploying a second mock token for testing...");
      const MockPlugToken = await ethers.getContractFactory("MockPlugToken");
      const mockUsdc = await MockPlugToken.deploy();
      await mockUsdc.waitForDeployment();
      usdcTokenAddress = await mockUsdc.getAddress();
      deployed.mockUsdcToken = usdcTokenAddress;
      console.log("     MockUsdcToken:       ", usdcTokenAddress, "\n");
    }
  }

  // ─── 1. CLARegistry ───────────────────────────────────────────────────────
  console.log("1/8  Deploying CLARegistry...");
  const CLARegistry = await ethers.getContractFactory("CLARegistry");
  const claRegistry = await CLARegistry.deploy(deployer.address);
  await claRegistry.waitForDeployment();
  deployed.claRegistry = await claRegistry.getAddress();
  console.log("     CLARegistry:         ", deployed.claRegistry);

  const claTextHash = ethers.keccak256(ethers.toUtf8Bytes("Digital Plug CLA v1.0 — see IPFS"));
  await claRegistry.publishCLAVersion(claTextHash, "bafybeicla_v1_ipfs_cid_here");
  console.log("     CLA v1 published\n");

  // ─── 2. BountyVault ───────────────────────────────────────────────────────
  console.log("2/8  Deploying BountyVault...");
  const BountyVault = await ethers.getContractFactory("BountyVault");
  const bountyVault = await BountyVault.deploy(plugTokenAddress, deployed.claRegistry, deployer.address);
  await bountyVault.waitForDeployment();
  deployed.bountyVault = await bountyVault.getAddress();
  console.log("     BountyVault:         ", deployed.bountyVault);

  await claRegistry.setAuthorizedBountyContract(deployed.bountyVault, true);
  console.log("     BountyVault authorized in CLARegistry\n");

  // ─── 3. SusuFactory ───────────────────────────────────────────────────────
  console.log("3/8  Deploying SusuFactory...");
  const SusuFactory = await ethers.getContractFactory("SusuFactory");
  const susuFactory = await SusuFactory.deploy(plugTokenAddress, deployer.address);
  await susuFactory.waitForDeployment();
  deployed.susuFactory = await susuFactory.getAddress();
  console.log("     SusuFactory:         ", deployed.susuFactory, "\n");

  // ─── 4. ScoreRegistry ─────────────────────────────────────────────────────
  console.log("4/8  Deploying ScoreRegistry...");
  const ScoreRegistry = await ethers.getContractFactory("ScoreRegistry");
  const scoreRegistry = await ScoreRegistry.deploy(deployer.address);
  await scoreRegistry.waitForDeployment();
  deployed.scoreRegistry = await scoreRegistry.getAddress();
  console.log("     ScoreRegistry:       ", deployed.scoreRegistry, "\n");

  // ─── 5. BlackBusinessRegistry ─────────────────────────────────────────────
  console.log("5/8  Deploying BlackBusinessRegistry...");
  const BBRegistry = await ethers.getContractFactory("BlackBusinessRegistry");
  const bbRegistry = await BBRegistry.deploy(plugTokenAddress, deployer.address, deployer.address);
  await bbRegistry.waitForDeployment();
  deployed.bbRegistry = await bbRegistry.getAddress();
  console.log("     BlackBusinessRegistry:", deployed.bbRegistry, "\n");

  // ─── 6. WhiteLabelLicense ─────────────────────────────────────────────────
  console.log("6/8  Deploying WhiteLabelLicense...");
  const WhiteLabelLicense = await ethers.getContractFactory("WhiteLabelLicense");
  const whiteLabel = await WhiteLabelLicense.deploy(usdcTokenAddress, deployer.address, deployer.address);
  await whiteLabel.waitForDeployment();
  deployed.whiteLabelLicense = await whiteLabel.getAddress();
  console.log("     WhiteLabelLicense:   ", deployed.whiteLabelLicense, "\n");

  // ─── 7. Sample InheritanceVault ───────────────────────────────────────────
  // In production each user deploys their own via a VaultFactory.
  console.log("7/8  Deploying sample InheritanceVault...");
  const InheritanceVault = await ethers.getContractFactory("InheritanceVault");
  const vault = await InheritanceVault.deploy(
    deployer.address,
    "Digital Plug Demo Vault",
    180 * 24 * 60 * 60, // 180 day inactivity window
    3 // 3-of-5 quorum
  );
  await vault.waitForDeployment();
  deployed.sampleVault = await vault.getAddress();
  console.log("     InheritanceVault:    ", deployed.sampleVault, "\n");

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  DIGITAL PLUG CONTRACT DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════");
  Object.entries(deployed).forEach(([name, addr]) => {
    console.log(`  ${name.padEnd(25)} ${addr}`);
  });
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nSave these addresses to your .env and frontend config.");
  console.log("Next: verify on Polygonscan with `npx hardhat verify`");

  return deployed;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
