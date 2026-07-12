const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlugRegistry", function () {
  let registry, admin, registrar, alice, bob;

  beforeEach(async function () {
    [admin, registrar, alice, bob] = await ethers.getSigners();
    const PlugRegistry = await ethers.getContractFactory("PlugRegistry");
    registry = await PlugRegistry.deploy(admin.address);
    await registry.grantRole(await registry.REGISTRAR_ROLE(), registrar.address);
  });

  it("registers a domain and sets a 500 default reputation", async function () {
    const YEAR = 365 * 24 * 60 * 60;
    await expect(registry.connect(registrar).register(alice.address, "vance", "plug", YEAR))
      .to.emit(registry, "DomainRegistered");
    expect(await registry.ownerOf(1)).to.equal(alice.address);
    expect(await registry.getReputation(1)).to.equal(500);
    expect(await registry.fullName(1)).to.equal("vance.plug");
  });

  it("rejects registration from a non-registrar", async function () {
    await expect(
      registry.connect(alice).register(alice.address, "vance", "plug", 1000)
    ).to.be.reverted;
  });

  it("rejects registering an already-taken, unexpired name", async function () {
    await registry.connect(registrar).register(alice.address, "vance", "plug", 1000);
    await expect(
      registry.connect(registrar).register(bob.address, "vance", "plug", 1000)
    ).to.be.revertedWithCustomError(registry, "NameTaken");
  });

  it("allows re-registration once expired", async function () {
    await registry.connect(registrar).register(alice.address, "vance", "plug", 100);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine");
    await expect(registry.connect(registrar).register(bob.address, "vance", "plug", 1000))
      .to.emit(registry, "DomainRegistered");
    expect(await registry.ownerOf(2)).to.equal(bob.address);
  });

  it("renews a domain, extending from current expiry", async function () {
    await registry.connect(registrar).register(alice.address, "vance", "plug", 1000);
    const before = (await registry.domains(1)).expiresAt;
    await registry.connect(registrar).renew(1, 500);
    const after = (await registry.domains(1)).expiresAt;
    expect(after).to.equal(before + 500n);
  });

  it("reports isAvailable correctly", async function () {
    expect(await registry.isAvailable("fresh", "plug")).to.equal(true);
    await registry.connect(registrar).register(alice.address, "fresh", "plug", 1000);
    expect(await registry.isAvailable("fresh", "plug")).to.equal(false);
  });

  it("lets the owner set a resolver, but not a non-owner", async function () {
    await registry.connect(registrar).register(alice.address, "vance", "plug", 1000);
    await expect(registry.connect(alice).setResolver(1, bob.address))
      .to.emit(registry, "ResolverSet");
    await expect(registry.connect(bob).setResolver(1, bob.address))
      .to.be.revertedWithCustomError(registry, "NotTokenOwner");
  });

  it("blocks release before the grace period and allows it after", async function () {
    await registry.connect(registrar).register(alice.address, "vance", "plug", 100);
    await expect(registry.releaseExpired(1)).to.be.revertedWithCustomError(registry, "NotExpired");
    await ethers.provider.send("evm_increaseTime", [100 + 30 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");
    await expect(registry.releaseExpired(1)).to.emit(registry, "DomainReleased");
    expect(await registry.isAvailable("vance", "plug")).to.equal(true);
  });

  it("lets a REPUTATION_ROLE holder set reputation within bounds", async function () {
    await registry.connect(registrar).register(alice.address, "vance", "plug", 1000);
    await registry.grantRole(await registry.REPUTATION_ROLE(), admin.address);
    await registry.setReputation(1, 800);
    expect(await registry.getReputation(1)).to.equal(800);
    await expect(registry.setReputation(1, 1001)).to.be.revertedWithCustomError(registry, "InvalidScore");
  });
});
