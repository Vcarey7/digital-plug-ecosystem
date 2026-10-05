const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TLDCatalog", function () {
  let catalog, admin;

  beforeEach(async function () {
    [admin] = await ethers.getSigners();
    const TLDCatalog = await ethers.getContractFactory("TLDCatalog");
    catalog = await TLDCatalog.deploy(admin.address);
  });

  it("lists a TLD with tier/category/reserved metadata", async function () {
    await catalog.listTLD("plug", 0, "flagship", true); // LEGENDARY, reserved
    const [listed, tier, , reserved, minted] = await catalog.getEntry("plug");
    expect(listed).to.equal(true);
    expect(tier).to.equal(0);
    expect(reserved).to.equal(true);
    expect(minted).to.equal(false);
  });

  it("blocks listing the same TLD twice", async function () {
    await catalog.listTLD("plug", 0, "flagship", true);
    await expect(catalog.listTLD("plug", 1, "flagship", true)).to.be.revertedWithCustomError(
      catalog,
      "AlreadyListed"
    );
  });

  it("batch-lists many TLDs and silently skips duplicates", async function () {
    await catalog.listTLD("plug", 0, "flagship", true);
    await catalog.batchListTLD(
      ["plug", "dbws", "vault"],
      [0, 0, 1],
      ["flagship", "flagship", "finance"],
      [true, true, false]
    );
    expect(await catalog.catalogSize()).to.equal(3); // "plug" skipped as dupe
    const [listed] = await catalog.getEntry("dbws");
    expect(listed).to.equal(true);
  });

  it("returns tier-derived mint price, subdomain cut, and renewal", async function () {
    await catalog.listTLD("hustle", 2, "community", false); // STANDARD
    expect(await catalog.mintPriceOf("hustle")).to.equal(ethers.parseEther("100"));
    expect(await catalog.subdomainCutBpsOf("hustle")).to.equal(1_000);
    expect(await catalog.renewalOf("hustle")).to.equal(ethers.parseEther("50"));
  });

  it("reports isPubliclyMintable as false for reserved or already-minted TLDs", async function () {
    await catalog.listTLD("plug", 0, "flagship", true); // reserved
    await catalog.listTLD("hustle", 2, "community", false);
    expect(await catalog.isPubliclyMintable("plug")).to.equal(false);
    expect(await catalog.isPubliclyMintable("hustle")).to.equal(true);

    await catalog.setMintedFlag("hustle", true);
    expect(await catalog.isPubliclyMintable("hustle")).to.equal(false);
  });

  it("lets admin reconfigure tier economics", async function () {
    await catalog.configureTier(3, ethers.parseEther("50"), 2_000, ethers.parseEther("40"));
    const cfg = await catalog.tierConfig(3);
    expect(cfg.mintPrice).to.equal(ethers.parseEther("50"));
    expect(cfg.subdomainCutBps).to.equal(2_000);
  });

  it("blocks non-curators from listing", async function () {
    const [, outsider] = await ethers.getSigners();
    await expect(catalog.connect(outsider).listTLD("plug", 0, "flagship", true)).to.be.reverted;
  });
});

describe("TLD catalog data (tld/catalog.js)", function () {
  const { SEED_LIST, buildSeedList } = require("../tld/catalog");

  it("produces a deduplicated seed list with no repeated TLD strings", function () {
    const seen = new Set();
    for (const entry of SEED_LIST) {
      expect(seen.has(entry.tld)).to.equal(false);
      seen.add(entry.tld);
    }
    expect(SEED_LIST.length).to.be.greaterThan(150);
  });

  it("is deterministic across rebuilds", function () {
    expect(buildSeedList().length).to.equal(SEED_LIST.length);
  });
});
