const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BatchMinting", function () {
  let registry, batch, owner, tldRegistrar, alice, resolverAddr;
  const YEAR = 365 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, tldRegistrar, alice, resolverAddr] = await ethers.getSigners();
    const DomainRegistry = await ethers.getContractFactory("DomainRegistry");
    registry = await DomainRegistry.deploy("Digital Plug Domains", "DPD", tldRegistrar.address);
    await registry.waitForDeployment();

    const BatchMinting = await ethers.getContractFactory("BatchMinting");
    batch = await BatchMinting.deploy(await registry.getAddress());
    await batch.waitForDeployment();

    await registry.connect(tldRegistrar).registerTLD("plug", owner.address, resolverAddr.address, "ipfs://plug");
    await registry.connect(owner).setAuthorizedRegistrar(await batch.getAddress(), true);
  });

  it("batch-registers multiple domains with a discount applied, minted to the buyer", async function () {
    const names = ["batch1", "batch2", "batch3"];
    const basePrice = await registry.baseDomainPrice();
    const domains = names.map((domain) => ({
      tld: "plug",
      domain,
      duration: YEAR,
      resolver: resolverAddr.address,
      metadataURI: `ipfs://${domain}`,
    }));

    const totalCost = await batch.calculateBatchDomainCost(3, basePrice);
    expect(totalCost).to.be.lessThan(basePrice * 3n);

    await batch.connect(alice).batchRegisterDomains(domains, { value: totalCost });

    for (const domain of names) {
      const hash = await registry.namehash(`${domain}.plug`);
      const info = await registry.getDomain(hash);
      expect(info.owner).to.equal(alice.address);
    }
  });

  it("rejects batch registration if BatchMinting isn't an authorized registrar", async function () {
    await registry.connect(owner).setAuthorizedRegistrar(await batch.getAddress(), false);
    const basePrice = await registry.baseDomainPrice();
    const domains = [{ tld: "plug", domain: "blocked", duration: YEAR, resolver: resolverAddr.address, metadataURI: "ipfs://x" }];
    await expect(batch.connect(alice).batchRegisterDomains(domains, { value: basePrice })).to.be.revertedWith(
      "Not an authorized registrar"
    );
  });

  it("refunds overpayment after a batch registration", async function () {
    const basePrice = await registry.baseDomainPrice();
    const domains = [{ tld: "plug", domain: "refundtest", duration: YEAR, resolver: resolverAddr.address, metadataURI: "ipfs://x" }];
    const overpay = basePrice + ethers.parseEther("1");

    const balanceBefore = await ethers.provider.getBalance(alice.address);
    const tx = await batch.connect(alice).batchRegisterDomains(domains, { value: overpay });
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(alice.address);

    expect(balanceBefore - basePrice - gasCost).to.equal(balanceAfter);
  });

  it("rejects a batch larger than maxBatchSize", async function () {
    await batch.connect(owner).updateMaxBatchSize(2);
    const names = ["a", "b", "c"];
    const basePrice = await registry.baseDomainPrice();
    const domains = names.map((domain) => ({
      tld: "plug",
      domain,
      duration: YEAR,
      resolver: resolverAddr.address,
      metadataURI: "ipfs://x",
    }));
    await expect(batch.connect(alice).batchRegisterDomains(domains, { value: basePrice * 3n })).to.be.revertedWith(
      "Batch size exceeds limit"
    );
  });

  it("batch-registers subdomains under a domain the buyer owns", async function () {
    // Give alice a domain to hang subdomains off of.
    await registry.connect(owner).setAuthorizedRegistrar(owner.address, true);
    await registry.connect(owner).registerDomainFor("plug", "alice", alice.address, YEAR, resolverAddr.address, "ipfs://alice");

    const subPrice = await registry.baseSubdomainPrice();
    const subdomains = ["blog", "shop"].map((subdomain) => ({
      parentDomain: "alice.plug",
      subdomain,
      owner: alice.address,
      duration: YEAR,
      resolver: resolverAddr.address,
      metadataURI: `ipfs://${subdomain}`,
    }));
    const totalCost = await batch.calculateBatchSubdomainCost(2, subPrice);

    await batch.connect(alice).batchRegisterSubdomains(subdomains, { value: totalCost });

    for (const sub of ["blog", "shop"]) {
      const hash = await registry.namehash(`${sub}.alice.plug`);
      expect((await registry.getDomain(hash)).owner).to.equal(alice.address);
    }
  });

  it("rejects batch subdomain registration from a non-parent-owner", async function () {
    await registry.connect(owner).setAuthorizedRegistrar(owner.address, true);
    await registry.connect(owner).registerDomainFor("plug", "alice", alice.address, YEAR, resolverAddr.address, "ipfs://alice");

    const subPrice = await registry.baseSubdomainPrice();
    const subdomains = [
      { parentDomain: "alice.plug", subdomain: "blog", owner: owner.address, duration: YEAR, resolver: resolverAddr.address, metadataURI: "ipfs://x" },
    ];
    await expect(
      batch.connect(owner).batchRegisterSubdomains(subdomains, { value: subPrice })
    ).to.be.revertedWith("Only parent domain owner can register subdomains");
  });
});
