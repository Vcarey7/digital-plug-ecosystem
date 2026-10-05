const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("DomainRegistry", function () {
  let registry, owner, tldRegistrar, alice, bob, resolverAddr;
  const YEAR = 365 * 24 * 60 * 60;
  const SECRET = ethers.encodeBytes32String("shh");

  beforeEach(async function () {
    [owner, tldRegistrar, alice, bob, resolverAddr] = await ethers.getSigners();
    const DomainRegistry = await ethers.getContractFactory("DomainRegistry");
    registry = await DomainRegistry.deploy("Digital Plug Domains", "DPD", tldRegistrar.address);
    await registry.waitForDeployment();
  });

  async function registerTLD(tld, tldOwner = owner) {
    await registry.connect(tldRegistrar).registerTLD(tld, tldOwner.address, resolverAddr.address, `ipfs://${tld}`);
    return registry.namehash(tld);
  }

  async function commitAndRegisterDomain(signer, tld, domain, duration = YEAR, secret = SECRET) {
    const commitment = await registry.makeDomainCommitment(tld, domain, signer.address, secret);
    await registry.connect(signer).commit(commitment);
    await time.increase(61);
    const cost = await registry.baseDomainPrice();
    await registry
      .connect(signer)
      .registerDomain(tld, domain, duration, resolverAddr.address, `ipfs://${domain}.${tld}`, secret, { value: cost });
    return registry.namehash(`${domain}.${tld}`);
  }

  it("registers a TLD and mints it as an NFT", async function () {
    const tldHash = await registerTLD("plug");
    expect(await registry.registeredTLDs(tldHash)).to.equal(true);
    const domainInfo = await registry.getDomain(tldHash);
    expect(domainInfo.owner).to.equal(owner.address);
    expect(domainInfo.isTLD).to.equal(true);
  });

  it("rejects TLD registration from a non-registrar", async function () {
    await expect(
      registry.connect(alice).registerTLD("plug", alice.address, resolverAddr.address, "ipfs://plug")
    ).to.be.revertedWith("Only TLD registrar can perform this action");
  });

  it("registers a domain via commit-reveal and mints an NFT to the registrant", async function () {
    await registerTLD("plug");
    const domainHash = await commitAndRegisterDomain(alice, "plug", "alice");
    const info = await registry.getDomain(domainHash);
    expect(info.owner).to.equal(alice.address);
    expect(info.name).to.equal("alice.plug");
    expect(await registry.ownerOf(info.tokenId)).to.equal(alice.address);
  });

  it("rejects registerDomain without a prior commitment", async function () {
    await registerTLD("plug");
    const cost = await registry.baseDomainPrice();
    await expect(
      registry.connect(alice).registerDomain("plug", "nocommit", YEAR, resolverAddr.address, "ipfs://x", SECRET, { value: cost })
    ).to.be.revertedWith("No matching commitment found");
  });

  it("rejects reveal before minCommitmentAge has passed", async function () {
    await registerTLD("plug");
    const commitment = await registry.makeDomainCommitment("plug", "fast", alice.address, SECRET);
    await registry.connect(alice).commit(commitment);
    const cost = await registry.baseDomainPrice();
    await expect(
      registry.connect(alice).registerDomain("plug", "fast", YEAR, resolverAddr.address, "ipfs://x", SECRET, { value: cost })
    ).to.be.revertedWith("Commitment too new");
  });

  it("prevents front-running: an attacker cannot reuse another user's commitment", async function () {
    await registerTLD("plug");
    // Alice commits to "frontrun.plug"; Bob sees the commitment hash in the
    // mempool but cannot derive Alice's secret from it, so he cannot forge
    // a matching commitment bound to his own address.
    const commitment = await registry.makeDomainCommitment("plug", "frontrun", alice.address, SECRET);
    await registry.connect(alice).commit(commitment);
    await time.increase(61);

    const cost = await registry.baseDomainPrice();
    const bobCommitment = await registry.makeDomainCommitment("plug", "frontrun", bob.address, SECRET);
    expect(bobCommitment).to.not.equal(commitment);
    await expect(
      registry.connect(bob).registerDomain("plug", "frontrun", YEAR, resolverAddr.address, "ipfs://x", SECRET, { value: cost })
    ).to.be.revertedWith("No matching commitment found");
  });

  it("rejects registering an already-registered domain", async function () {
    await registerTLD("plug");
    await commitAndRegisterDomain(alice, "plug", "taken");

    const commitment = await registry.makeDomainCommitment("plug", "taken", bob.address, SECRET);
    await registry.connect(bob).commit(commitment);
    await time.increase(61);
    const cost = await registry.baseDomainPrice();
    await expect(
      registry.connect(bob).registerDomain("plug", "taken", YEAR, resolverAddr.address, "ipfs://x", SECRET, { value: cost })
    ).to.be.revertedWith("Domain already exists");
  });

  it("registers a subdomain directly (no commit-reveal needed, owner-gated)", async function () {
    await registerTLD("plug");
    const domainHash = await commitAndRegisterDomain(alice, "plug", "alice");
    const subPrice = await registry.baseSubdomainPrice();

    await registry
      .connect(alice)
      .registerSubdomain("alice.plug", "blog", bob.address, YEAR, resolverAddr.address, "ipfs://blog", { value: subPrice });

    const subHash = await registry.namehash("blog.alice.plug");
    const subInfo = await registry.getDomain(subHash);
    expect(subInfo.owner).to.equal(bob.address);
    expect(subInfo.parentHash).to.equal(domainHash);
  });

  it("rejects subdomain registration from a non-parent-owner", async function () {
    await registerTLD("plug");
    await commitAndRegisterDomain(alice, "plug", "alice");
    const subPrice = await registry.baseSubdomainPrice();
    await expect(
      registry.connect(bob).registerSubdomain("alice.plug", "blog", bob.address, YEAR, resolverAddr.address, "ipfs://blog", { value: subPrice })
    ).to.be.revertedWith("Only parent domain owner can register subdomains");
  });

  it("allows the domain owner to renew and extend expiry", async function () {
    await registerTLD("plug");
    const domainHash = await commitAndRegisterDomain(alice, "plug", "renewme");
    const before = (await registry.getDomain(domainHash)).expiry;
    const cost = await registry.baseDomainPrice();
    await registry.connect(alice).renewDomain(domainHash, YEAR, { value: cost });
    const after = (await registry.getDomain(domainHash)).expiry;
    expect(after).to.equal(before + BigInt(YEAR));
  });

  it("rejects renewal from a non-owner", async function () {
    await registerTLD("plug");
    const domainHash = await commitAndRegisterDomain(alice, "plug", "notyours");
    const cost = await registry.baseDomainPrice();
    await expect(
      registry.connect(bob).renewDomain(domainHash, YEAR, { value: cost })
    ).to.be.revertedWith("Only domain owner can perform this action");
  });

  it("lets the domain owner update the resolver", async function () {
    await registerTLD("plug");
    const domainHash = await commitAndRegisterDomain(alice, "plug", "resolveme");
    await registry.connect(alice).setResolver(domainHash, bob.address);
    expect((await registry.getDomain(domainHash)).resolver).to.equal(bob.address);
  });

  describe("authorized registrar path (registerDomainFor / renewDomainFor)", function () {
    it("rejects calls from an unauthorized address", async function () {
      await registerTLD("plug");
      await expect(
        registry.connect(alice).registerDomainFor("plug", "viaplug", bob.address, YEAR, resolverAddr.address, "ipfs://x")
      ).to.be.revertedWith("Not an authorized registrar");
    });

    it("lets an authorized registrar mint directly to a buyer with no native payment or commit step", async function () {
      await registerTLD("plug");
      await registry.connect(owner).setAuthorizedRegistrar(alice.address, true);

      await registry.connect(alice).registerDomainFor("plug", "viaplug", bob.address, YEAR, resolverAddr.address, "ipfs://x");

      const domainHash = await registry.namehash("viaplug.plug");
      const info = await registry.getDomain(domainHash);
      expect(info.owner).to.equal(bob.address);
    });

    it("lets an authorized registrar renew on behalf of the owner", async function () {
      await registerTLD("plug");
      await registry.connect(owner).setAuthorizedRegistrar(alice.address, true);
      await registry.connect(alice).registerDomainFor("plug", "viaplug2", bob.address, YEAR, resolverAddr.address, "ipfs://x");
      const domainHash = await registry.namehash("viaplug2.plug");
      const before = (await registry.getDomain(domainHash)).expiry;

      await registry.connect(alice).renewDomainFor(domainHash, YEAR);

      const after = (await registry.getDomain(domainHash)).expiry;
      expect(after).to.equal(before + BigInt(YEAR));
    });

    it("revoking authorization blocks further calls", async function () {
      await registerTLD("plug");
      await registry.connect(owner).setAuthorizedRegistrar(alice.address, true);
      await registry.connect(owner).setAuthorizedRegistrar(alice.address, false);
      await expect(
        registry.connect(alice).registerDomainFor("plug", "revoked", bob.address, YEAR, resolverAddr.address, "ipfs://x")
      ).to.be.revertedWith("Not an authorized registrar");
    });

    it("registerSubdomainFor checks the acting owner against the real parent owner, not msg.sender", async function () {
      await registerTLD("plug");
      const domainHash = await commitAndRegisterDomain(alice, "plug", "alice");
      await registry.connect(owner).setAuthorizedRegistrar(owner.address, true);

      // owner (the registrar) is not alice.plug's owner, so impersonating
      // alice must be rejected even though owner itself is authorized.
      await expect(
        registry.connect(owner).registerSubdomainFor("alice.plug", "blog", bob.address, YEAR, resolverAddr.address, "ipfs://x", owner.address)
      ).to.be.revertedWith("Only parent domain owner can register subdomains");

      await registry
        .connect(owner)
        .registerSubdomainFor("alice.plug", "blog", bob.address, YEAR, resolverAddr.address, "ipfs://x", alice.address);
      const subHash = await registry.namehash("blog.alice.plug");
      const info = await registry.getDomain(subHash);
      expect(info.owner).to.equal(bob.address);
      expect(info.parentHash).to.equal(domainHash);
    });
  });

  it("lets the owner withdraw collected native-currency fees", async function () {
    await registerTLD("plug");
    const cost = await registry.baseDomainPrice();
    await commitAndRegisterDomain(alice, "plug", "feetest");

    const contractBalance = await ethers.provider.getBalance(await registry.getAddress());
    expect(contractBalance).to.equal(cost);

    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await registry.connect(owner).withdraw();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalance - gasCost);
  });
});
