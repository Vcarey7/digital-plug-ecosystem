const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlugRegistrar", function () {
  let registry, registrar, usdc, plug, admin, treasury, alice, affiliateTracker;
  const SECRET = ethers.encodeBytes32String("shh");

  beforeEach(async function () {
    [admin, treasury, alice, affiliateTracker] = await ethers.getSigners();

    const PlugRegistry = await ethers.getContractFactory("PlugRegistry");
    registry = await PlugRegistry.deploy(admin.address);

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);

    const PlugRegistrar = await ethers.getContractFactory("PlugRegistrar");
    registrar = await PlugRegistrar.deploy(
      await registry.getAddress(),
      await usdc.getAddress(),
      await plug.getAddress(),
      treasury.address,
      admin.address
    );

    await registry.grantRole(await registry.REGISTRAR_ROLE(), await registrar.getAddress());
    await registrar.configureTLD("plug", true, 10_000_000n, ethers.parseEther("8"), 30_000, 15_000);

    await usdc.mint(alice.address, 1_000_000_000n);
    await usdc.connect(alice).approve(await registrar.getAddress(), ethers.MaxUint256);
  });

  async function commitAndWait(name, tld, buyer, secret) {
    const commitment = await registrar.makeCommitment(name, tld, buyer.address, secret);
    await registrar.connect(buyer).commit(commitment);
    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine");
  }

  it("quotes a base price and applies the 3-char premium multiplier", async function () {
    const base = await registrar.quote("vance", "plug", 1, false);
    const short = await registrar.quote("abc", "plug", 1, false);
    expect(short).to.equal((base * 30_000n) / 10_000n);
  });

  it("rejects registerDomain reveal without a prior commit (front-running protection)", async function () {
    await expect(
      registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(registrar, "CommitmentNotFound");
  });

  it("rejects revealing before minCommitmentAge has passed", async function () {
    const commitment = await registrar.makeCommitment("vance", "plug", alice.address, SECRET);
    await registrar.connect(alice).commit(commitment);
    await expect(
      registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(registrar, "CommitmentTooNew");
  });

  it("rejects a mismatched secret from front-running the commitment", async function () {
    await commitAndWait("vance", "plug", alice, SECRET);
    const wrongSecret = ethers.encodeBytes32String("wrong");
    await expect(
      registrar.connect(alice).registerDomain("vance", "plug", wrongSecret, 1, false, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(registrar, "CommitmentNotFound");
  });

  it("registers a domain in USDC after a valid commit-reveal", async function () {
    await commitAndWait("vance", "plug", alice, SECRET);
    const cost = await registrar.quote("vance", "plug", 1, false);
    await expect(registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, ethers.ZeroAddress))
      .to.emit(registrar, "Registered");
    expect(await usdc.balanceOf(treasury.address)).to.equal(cost);
    expect(await registry.ownerOf(1)).to.equal(alice.address);
  });

  it("registers a domain in $PLUG at the discounted rate", async function () {
    await plug.connect(admin).transfer(alice.address, ethers.parseEther("1000"));
    await plug.connect(alice).approve(await registrar.getAddress(), ethers.MaxUint256);
    await commitAndWait("vance", "plug", alice, SECRET);
    const cost = await registrar.quote("vance", "plug", 1, true);
    await registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, true, ethers.ZeroAddress);
    expect(await plug.balanceOf(treasury.address)).to.equal(cost);
  });

  it("prevents replaying the same commitment twice", async function () {
    await commitAndWait("vance", "plug", alice, SECRET);
    await registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, ethers.ZeroAddress);
    await expect(
      registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(registrar, "CommitmentNotFound");
  });

  it("rejects registering an unavailable name even with a valid commitment", async function () {
    await commitAndWait("vance", "plug", alice, SECRET);
    await registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, ethers.ZeroAddress);

    const secret2 = ethers.encodeBytes32String("shh2");
    await commitAndWait("vance", "plug", alice, secret2);
    await expect(
      registrar.connect(alice).registerDomain("vance", "plug", secret2, 1, false, ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(registrar, "NameUnavailable");
  });

  it("renews a domain and collects payment", async function () {
    await commitAndWait("vance", "plug", alice, SECRET);
    await registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, ethers.ZeroAddress);
    const before = (await registry.domains(1)).expiresAt;
    await registrar.connect(alice).renewDomain(1, "vance", "plug", 1, false);
    const after = (await registry.domains(1)).expiresAt;
    expect(after).to.be.greaterThan(before);
  });

  it("reports affiliate sales to the affiliate tracker", async function () {
    const MockTracker = await ethers.getContractFactory("AffiliateTracker");
    const tracker = await MockTracker.deploy(await plug.getAddress(), treasury.address, admin.address);
    await registrar.setAffiliateTracker(await tracker.getAddress());
    await tracker.grantRole(await tracker.REPORTER_ROLE(), await registrar.getAddress());

    await commitAndWait("vance", "plug", alice, SECRET);
    await registrar.connect(alice).registerDomain("vance", "plug", SECRET, 1, false, affiliateTracker.address);
    const info = await tracker.affiliates(affiliateTracker.address);
    expect(info.referrals).to.equal(1);
  });
});
