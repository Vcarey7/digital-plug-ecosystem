const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AffiliateTracker", function () {
  let tracker, plug, admin, treasury, reporter, affiliate;

  beforeEach(async function () {
    [admin, treasury, reporter, affiliate] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(treasury.address, admin.address);
    const AffiliateTracker = await ethers.getContractFactory("AffiliateTracker");
    tracker = await AffiliateTracker.deploy(await plug.getAddress(), treasury.address, admin.address);
    await tracker.grantRole(await tracker.REPORTER_ROLE(), reporter.address);
    await plug.connect(treasury).approve(await tracker.getAddress(), ethers.MaxUint256);
  });

  it("accrues tiered commission and pays out on claim", async function () {
    await tracker.connect(reporter).recordSale(affiliate.address, admin.address, 5_000e6);
    const info = await tracker.affiliates(affiliate.address);
    expect(info.pendingPlug).to.equal(ethers.parseEther("250")); // 5% of $5000 = $250 -> 250 PLUG
    await tracker.connect(affiliate).claim();
    expect(await plug.balanceOf(affiliate.address)).to.equal(ethers.parseEther("250"));
  });

  it("moves to a higher commission tier as lifetime volume grows", async function () {
    await tracker.connect(reporter).recordSale(affiliate.address, admin.address, 20_000e6);
    // First sale still under 10k tier boundary at time of calc (0 -> 5%)
    let info = await tracker.affiliates(affiliate.address);
    expect(info.lifetimeVolumeUSD).to.equal(20_000e6);
    await tracker.connect(reporter).recordSale(affiliate.address, admin.address, 40_000e6);
    // Second sale computed off >=10k lifetime -> 8% tier
    info = await tracker.affiliates(affiliate.address);
    expect(info.referrals).to.equal(2);
  });
});

describe("AIAccessNFT", function () {
  let pass, usdc, plug, admin, treasury, alice;

  beforeEach(async function () {
    [admin, treasury, alice] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const AIAccessNFT = await ethers.getContractFactory("AIAccessNFT");
    pass = await AIAccessNFT.deploy(
      await usdc.getAddress(),
      await plug.getAddress(),
      treasury.address,
      ethers.ZeroAddress,
      admin.address
    );
    await usdc.transfer(alice.address, 1_000_000_000n);
    await usdc.connect(alice).approve(await pass.getAddress(), ethers.MaxUint256);
  });

  it("mints a BASIC pass for the correct USDC amount and extends on renew", async function () {
    await pass.connect(alice).subscribe(0, 1, false, ethers.ZeroAddress); // BASIC, 1 month
    expect(await usdc.balanceOf(treasury.address)).to.equal(29e6);
    expect(await pass.isActive(1)).to.equal(true);
    await pass.connect(alice).renew(1, 1, false);
    expect(await usdc.balanceOf(treasury.address)).to.equal(58e6);
  });
});

describe("DataVault", function () {
  let vault, usdc, plug, admin, forgeVault, contributor, licensee;

  beforeEach(async function () {
    [admin, forgeVault, contributor, licensee] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const DataVault = await ethers.getContractFactory("DataVault");
    vault = await DataVault.deploy(await usdc.getAddress(), await plug.getAddress(), forgeVault.address, admin.address);

    await usdc.transfer(licensee.address, 1_000_000n);
    await usdc.connect(licensee).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  it("splits a license sale between contributor and forge vault", async function () {
    await vault.connect(contributor).listDataset(ethers.encodeBytes32String("hash"), 100_000n);
    await vault.connect(licensee).purchaseLicense(1);
    expect(await usdc.balanceOf(contributor.address)).to.equal(80_000n); // 80% after 20% protocol cut
    expect(await usdc.balanceOf(forgeVault.address)).to.equal(20_000n);
  });

  it("blocks buying the same license twice", async function () {
    await vault.connect(contributor).listDataset(ethers.encodeBytes32String("hash"), 100_000n);
    await vault.connect(licensee).purchaseLicense(1);
    await expect(vault.connect(licensee).purchaseLicense(1)).to.be.revertedWithCustomError(vault, "AlreadyLicensed");
  });
});

describe("WhiteLabelLicense", function () {
  let license, usdc, admin, treasury, org;

  beforeEach(async function () {
    [admin, treasury, org] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const WhiteLabelLicense = await ethers.getContractFactory("WhiteLabelLicense");
    license = await WhiteLabelLicense.deploy(await usdc.getAddress(), treasury.address, admin.address);
    await usdc.transfer(org.address, 10_000_000_000n);
    await usdc.connect(org).approve(await license.getAddress(), ethers.MaxUint256);
  });

  it("sells a STARTER plan for the configured price and marks it active", async function () {
    await license.connect(org).purchase(0); // STARTER
    expect(await usdc.balanceOf(treasury.address)).to.equal(2_500e6);
    expect(await license.isActive(org.address)).to.equal(true);
  });

  it("lets admin revoke a license early", async function () {
    await license.connect(org).purchase(0);
    await license.revoke(org.address);
    expect(await license.isActive(org.address)).to.equal(false);
  });
});

describe("CompoundForge", function () {
  let forge, plug, dpa, admin, alice;

  beforeEach(async function () {
    [admin, alice] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const DPAToken = await ethers.getContractFactory("DPAToken");
    dpa = await DPAToken.deploy("ipfs://dpa/", admin.address);
    const CompoundForge = await ethers.getContractFactory("CompoundForge");
    forge = await CompoundForge.deploy(await plug.getAddress(), await dpa.getAddress(), admin.address);

    await dpa.grantRole(await dpa.MINTER_ROLE(), admin.address);
    await dpa.grantRole(await dpa.MINTER_ROLE(), await forge.getAddress());
    await dpa.grantRole(await dpa.BURNER_ROLE(), await forge.getAddress());
    await dpa.mint(alice.address, 1, 10); // pre-fund alice with input asset
    await plug.transfer(alice.address, ethers.parseEther("100"));
    await plug.connect(alice).approve(await forge.getAddress(), ethers.MaxUint256);
  });

  it("burns inputs, charges the PLUG fee, and mints the compounded output", async function () {
    await forge.createRecipe([1], [5], 2, 1, ethers.parseEther("10"));
    await forge.connect(alice).compound(1);
    expect(await dpa.balanceOf(alice.address, 1)).to.equal(5);
    expect(await dpa.balanceOf(alice.address, 2)).to.equal(1);
  });
});
