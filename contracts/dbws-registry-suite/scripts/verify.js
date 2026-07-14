/* eslint-disable no-console */
/**
 * verify.js — verifies all deployed registry contracts on Polygonscan.
 *   npx hardhat run scripts/verify.js --network amoy
 * Reads deployments/<network>/addresses.json and submits each with its
 * constructor args.
 */
const { run, network, ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const dir = path.join(__dirname, "..", "deployments", network.name);
  const addr = JSON.parse(fs.readFileSync(path.join(dir, "addresses.json"), "utf8"));
  const deployment = JSON.parse(fs.readFileSync(path.join(dir, "deployment.json"), "utf8"));
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || admin;
  const router = addr.RevenueRouter;
  const usdc = deployment.usdc;

  const jobs = [
    { name: "RevenueRouter", address: addr.RevenueRouter, args: [treasury, usdc, admin] },
    { name: "PlugRegistry", address: addr.PlugRegistry, args: [router, usdc, admin] },
    { name: "EntityRegistry", address: addr.EntityRegistry, args: [router, usdc, admin] },
    { name: "IPRegistry", address: addr.IPRegistry, args: [router, usdc, admin] },
    { name: "LicenseRegistry", address: addr.LicenseRegistry, args: [router, usdc, admin] },
    { name: "CommunityRegistry", address: addr.CommunityRegistry, args: [router, usdc, admin] },
  ];
  // NoteRegistry only deploys under the mainnet legal-hold gate (see
  // deploy.js) -- verify it too, but only if it actually got deployed.
  if (addr.NoteRegistry) {
    jobs.push({ name: "NoteRegistry", address: addr.NoteRegistry, args: [admin] });
  }

  for (const j of jobs) {
    try {
      await run("verify:verify", { address: j.address, constructorArguments: j.args });
      console.log(`✓ verified ${j.name}`);
    } catch (e) {
      console.log(`• ${j.name}: ${(e.message || "").split("\n")[0]}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
