const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CLARegistry", function () {
  let cla, admin, alice, bob, bountyContract;
  const DOC_HASH = ethers.encodeBytes32String("doc-v1");

  beforeEach(async function () {
    [admin, alice, bob, bountyContract] = await ethers.getSigners();
    const CLARegistry = await ethers.getContractFactory("CLARegistry");
    cla = await CLARegistry.deploy(admin.address);
    await cla.waitForDeployment();

    const versionHash = ethers.keccak256(ethers.toUtf8Bytes("CLA v1"));
    await cla.connect(admin).publishCLAVersion(versionHash, "ipfs://cla-v1");
  });

  it("lets a contributor sign the CLA and mints a soulbound NFT", async function () {
    await cla.connect(alice).signCLA(1 /* STARTER */, DOC_HASH, "alice-gh");
    expect(await cla.hasActiveCLA(alice.address)).to.equal(true);
    const tokenId = await cla.contributorToken(alice.address);
    expect(await cla.ownerOf(tokenId)).to.equal(alice.address);
  });

  it("rejects signing without a published CLA version", async function () {
    const CLARegistry = await ethers.getContractFactory("CLARegistry");
    const freshCla = await CLARegistry.deploy(admin.address);
    await freshCla.waitForDeployment();
    await expect(freshCla.connect(alice).signCLA(1, DOC_HASH, "alice-gh")).to.be.revertedWithCustomError(
      freshCla,
      "NoActiveCLAVersion"
    );
  });

  it("rejects signing twice", async function () {
    await cla.connect(alice).signCLA(1, DOC_HASH, "alice-gh");
    await expect(cla.connect(alice).signCLA(1, DOC_HASH, "alice-gh")).to.be.revertedWithCustomError(
      cla,
      "AlreadySigned"
    );
  });

  it("blocks transfers -- the CLA NFT is soulbound", async function () {
    await cla.connect(alice).signCLA(1, DOC_HASH, "alice-gh");
    const tokenId = await cla.contributorToken(alice.address);
    await expect(cla.connect(alice).transferFrom(alice.address, bob.address, tokenId)).to.be.revertedWithCustomError(
      cla,
      "Soulbound"
    );
  });

  it("permanently bans a revoked contributor from re-signing", async function () {
    await cla.connect(alice).signCLA(1, DOC_HASH, "alice-gh");
    await cla.connect(admin).revokeCLA(alice.address, "IP breach", true);
    expect(await cla.hasActiveCLA(alice.address)).to.equal(false);
    await expect(cla.connect(alice).signCLA(1, DOC_HASH, "alice-gh")).to.be.revertedWithCustomError(
      cla,
      "PermanentlyBanned"
    );
  });

  it("enforces tier requirements via meetsMinTier", async function () {
    await cla.connect(alice).signCLA(1 /* STARTER */, DOC_HASH, "alice-gh");
    expect(await cla.meetsMinTier(alice.address, 1)).to.equal(true);
    expect(await cla.meetsMinTier(alice.address, 3 /* ECOSYSTEM */)).to.equal(false);
  });

  it("blocks tier downgrades", async function () {
    await cla.connect(alice).signCLA(2 /* BUILDER */, DOC_HASH, "alice-gh");
    await expect(cla.connect(admin).upgradeTier(alice.address, 1 /* STARTER */)).to.be.revertedWithCustomError(
      cla,
      "CannotDowngradeTier"
    );
  });

  it("only lets authorized bounty contracts record contributions", async function () {
    await cla.connect(alice).signCLA(1, DOC_HASH, "alice-gh");
    await expect(cla.connect(bountyContract).recordContribution(alice.address, 100)).to.be.revertedWithCustomError(
      cla,
      "NotAuthorizedBountyContract"
    );

    await cla.connect(admin).setAuthorizedBountyContract(bountyContract.address, true);
    await cla.connect(bountyContract).recordContribution(alice.address, 100);
    const agreement = await cla.getAgreement(alice.address);
    expect(agreement.totalEarned).to.equal(100);
    expect(agreement.contributionCount).to.equal(1);
  });
});
