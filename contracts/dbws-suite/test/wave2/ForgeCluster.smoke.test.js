// WAVE 2 SMOKE TESTS — see README for the legal-hold list. Local-only proof
// of correctness, not a deployment green light.
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("[wave2] ForgeCore + DPAToken + AbsorptionFund", function () {
  let plug, usdc, dpa, forgeVault, insuranceFund, absorptionFund, forge, admin, alice;

  beforeEach(async function () {
    [admin, alice] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const DPAToken = await ethers.getContractFactory("DPAToken");
    dpa = await DPAToken.deploy("ipfs://dpa/", admin.address);

    const ForgeVault = await ethers.getContractFactory("ForgeVault");
    forgeVault = await ForgeVault.deploy(admin.address);
    const InsuranceFund = await ethers.getContractFactory("InsuranceFund");
    insuranceFund = await InsuranceFund.deploy(await usdc.getAddress(), 0, admin.address);
    const AbsorptionFund = await ethers.getContractFactory("AbsorptionFund");
    absorptionFund = await AbsorptionFund.deploy(await plug.getAddress(), await usdc.getAddress(), admin.address);

    const ForgeCore = await ethers.getContractFactory("ForgeCore");
    forge = await ForgeCore.deploy(
      await plug.getAddress(),
      await usdc.getAddress(),
      await dpa.getAddress(),
      await forgeVault.getAddress(),
      await insuranceFund.getAddress(),
      await absorptionFund.getAddress(),
      admin.address
    );
    await dpa.grantRole(await dpa.MINTER_ROLE(), await forge.getAddress());

    await plug.transfer(alice.address, ethers.parseEther("10000"));
    await plug.connect(alice).approve(await forge.getAddress(), ethers.MaxUint256);
    await forge.setRecipe(1, ethers.parseEther("100"), 0, true);
  });

  it("burns PLUG, splits fees across the three funds, and mints the DPA", async function () {
    const vaultBefore = await plug.balanceOf(await forgeVault.getAddress());
    await forge.connect(alice).forge(1, 1);
    expect(await dpa.balanceOf(alice.address, 1)).to.equal(1);
    expect(await plug.balanceOf(await forgeVault.getAddress())).to.be.greaterThan(vaultBefore);
    expect(await plug.balanceOf(await absorptionFund.getAddress())).to.be.greaterThan(0);
  });

  it("throttles forging by threat level and blocks entirely at LOCKDOWN", async function () {
    await forge.setThreatLevel(3); // LOCKDOWN
    await expect(forge.connect(alice).forge(1, 1)).to.be.revertedWithCustomError(forge, "LockedDown");
  });

  it("respects the annual emission cap on DPAToken", async function () {
    await dpa.setAnnualCap(1, 1);
    await forge.connect(alice).forge(1, 1);
    await expect(forge.connect(alice).forge(1, 1)).to.be.revertedWithCustomError(dpa, "AnnualCapExceeded");
  });

  it("[AbsorptionFund] deploys graduated buy-side support scaled by stress level", async function () {
    await usdc.transfer(await absorptionFund.getAddress(), 1_000_000n);
    await absorptionFund.setStressLevel(3); // 10%
    const before = await usdc.balanceOf(alice.address);
    await absorptionFund.deploy(alice.address);
    expect(await usdc.balanceOf(alice.address)).to.equal(before + 100_000n);
  });
});
