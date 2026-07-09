const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlugRegistrar", function () {
  let registry, plugRegistrar, usdc, plug, owner, tldRegistrar, alice, treasury, resolverAddr;
  const YEAR = 365 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, tldRegistrar, alice, treasury, resolverAddr] = await ethers.getSigners();

    const DomainRegistry = await ethers.getContractFactory("DomainRegistry");
    registry = await DomainRegistry.deploy("Digital Plug Domains", "DPD", tldRegistrar.address);
    await registry.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    plug = await MockERC20.deploy("Digital Plug Token", "PLUG", 18);
    await plug.waitForDeployment();

    const PlugRegistrar = await ethers.getContractFactory("PlugRegistrar");
    plugRegistrar = await PlugRegistrar.deploy(
      await registry.getAddress(),
      await usdc.getAddress(),
      await plug.getAddress(),
      treasury.address,
      resolverAddr.address,
      owner.address
    );
    await plugRegistrar.waitForDeployment();

    // Registry TLDs are stored without the leading dot.
    await registry.connect(tldRegistrar).registerTLD("plug", owner.address, resolverAddr.address, "ipfs://plug");
    await registry.connect(owner).setAuthorizedRegistrar(await plugRegistrar.getAddress(), true);

    await usdc.mint(alice.address, 1_000_000n * 10n ** 6n);
    await usdc.connect(alice).approve(await plugRegistrar.getAddress(), ethers.MaxUint256);
    await plug.mint(alice.address, 1_000_000n * 10n ** 18n);
    await plug.connect(alice).approve(await plugRegistrar.getAddress(), ethers.MaxUint256);
  });

  it("registers a domain paying in USDC and mints it to the buyer", async function () {
    const price = await plugRegistrar.getPrice("alice", ".plug", 1);
    const treasuryBefore = await usdc.balanceOf(treasury.address);

    await plugRegistrar.connect(alice).register("alice", ".plug", 1, false, ethers.ZeroAddress, "ipfs://alice");

    const domainHash = await registry.namehash("alice.plug");
    const info = await registry.getDomain(domainHash);
    expect(info.owner).to.equal(alice.address);

    const treasuryAfter = await usdc.balanceOf(treasury.address);
    expect(treasuryAfter - treasuryBefore).to.equal(price);
  });

  it("registers a domain paying in $PLUG with the configured discount", async function () {
    const usdcPrice = await plugRegistrar.getPrice("bob", ".plug", 1);
    const plugRate = await plugRegistrar.plugRate();
    const discountBps = await plugRegistrar.plugDiscountBps();
    const expectedPlugCost = ((usdcPrice * plugRate) / 1_000_000n) * (10000n - discountBps) / 10000n;

    const treasuryBefore = await plug.balanceOf(treasury.address);
    await plugRegistrar.connect(alice).register("bob", ".plug", 1, true, ethers.ZeroAddress, "ipfs://bob");
    const treasuryAfter = await plug.balanceOf(treasury.address);

    expect(treasuryAfter - treasuryBefore).to.equal(expectedPlugCost);
    const domainHash = await registry.namehash("bob.plug");
    expect((await registry.getDomain(domainHash)).owner).to.equal(alice.address);
  });

  it("prices short names higher than long names", async function () {
    const shortPrice = await plugRegistrar.getPrice("ab", ".plug", 1);
    const longPrice = await plugRegistrar.getPrice("averylongname", ".plug", 1);
    expect(shortPrice).to.be.greaterThan(longPrice);
  });

  it("lets the buyer renew their own domain", async function () {
    await plugRegistrar.connect(alice).register("renewme", ".plug", 1, false, ethers.ZeroAddress, "ipfs://renewme");
    const domainHash = await registry.namehash("renewme.plug");
    const before = (await registry.getDomain(domainHash)).expiry;

    await plugRegistrar.connect(alice).renew(domainHash, ".plug", 1, false);

    const after = (await registry.getDomain(domainHash)).expiry;
    expect(after).to.equal(before + BigInt(YEAR));
  });

  it("rejects renewal from someone who isn't the domain owner", async function () {
    await plugRegistrar.connect(alice).register("notyours", ".plug", 1, false, ethers.ZeroAddress, "ipfs://x");
    const domainHash = await registry.namehash("notyours.plug");
    await expect(
      plugRegistrar.connect(owner).renew(domainHash, ".plug", 1, false)
    ).to.be.revertedWith("Registrar: not domain owner");
  });

  it("fails if the registry hasn't authorized this PlugRegistrar instance", async function () {
    await registry.connect(owner).setAuthorizedRegistrar(await plugRegistrar.getAddress(), false);
    await expect(
      plugRegistrar.connect(alice).register("blocked", ".plug", 1, false, ethers.ZeroAddress, "ipfs://x")
    ).to.be.revertedWith("Not an authorized registrar");
  });

  it("rejects registration when the TLD has no configured pricing", async function () {
    await registry.connect(tldRegistrar).registerTLD("dbws", owner.address, resolverAddr.address, "ipfs://dbws");
    await plugRegistrar.connect(owner).setTldBasePrice(".unpriced", 0);
    await expect(
      plugRegistrar.connect(alice).register("name", ".unpriced", 1, false, ethers.ZeroAddress, "ipfs://x")
    ).to.be.revertedWith("Registrar: TLD not configured");
  });
});
