const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BountyVault", function () {
  let plug, cla, vault, admin, alice, bob;
  const DOC_HASH = ethers.encodeBytes32String("doc-v1");

  beforeEach(async function () {
    [admin, alice, bob] = await ethers.getSigners();

    const MockPlugToken = await ethers.getContractFactory("MockPlugToken");
    plug = await MockPlugToken.deploy();
    await plug.waitForDeployment();

    const CLARegistry = await ethers.getContractFactory("CLARegistry");
    cla = await CLARegistry.deploy(admin.address);
    await cla.waitForDeployment();
    const versionHash = ethers.keccak256(ethers.toUtf8Bytes("CLA v1"));
    await cla.connect(admin).publishCLAVersion(versionHash, "ipfs://cla-v1");

    const BountyVault = await ethers.getContractFactory("BountyVault");
    vault = await BountyVault.deploy(await plug.getAddress(), await cla.getAddress(), admin.address);
    await vault.waitForDeployment();

    await cla.connect(admin).setAuthorizedBountyContract(await vault.getAddress(), true);
    await plug.connect(admin).transfer(await vault.getAddress(), ethers.parseEther("1000"));

    await cla.connect(alice).signCLA(2 /* BUILDER */, DOC_HASH, "alice-gh");
  });

  it("runs the full bounty lifecycle and pays out $PLUG", async function () {
    await vault.connect(admin).createBounty("Fix bug", "Kit-A-M1", 1 /* STARTER */, ethers.parseEther("50"), 500);
    await vault.connect(alice).claimBounty(1);
    const prHash = ethers.keccak256(ethers.toUtf8Bytes("https://github.com/org/repo/pull/1"));
    await vault.connect(alice).submitBounty(1, prHash);

    const balanceBefore = await plug.balanceOf(alice.address);
    await vault.connect(admin).approveBounty(1);
    const balanceAfter = await plug.balanceOf(alice.address);

    expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("50"));
    const bounty = await vault.bounties(1);
    expect(bounty.status).to.equal(4); // PAID

    const agreement = await cla.getAgreement(alice.address);
    expect(agreement.totalEarned).to.equal(ethers.parseEther("50"));
  });

  it("blocks claiming without a CLA", async function () {
    await vault.connect(admin).createBounty("Fix bug", "Kit-A-M1", 1, ethers.parseEther("50"), 500);
    await expect(vault.connect(bob).claimBounty(1)).to.be.revertedWithCustomError(vault, "NoCLA");
  });

  it("blocks claiming a bounty above the contributor's tier", async function () {
    await vault.connect(admin).createBounty("Ecosystem bounty", "Kit-C-M1", 3 /* ECOSYSTEM */, ethers.parseEther("50"), 500);
    await expect(vault.connect(alice).claimBounty(1)).to.be.revertedWithCustomError(vault, "InsufficientTier");
  });

  it("blocks a non-claimer from submitting", async function () {
    await vault.connect(admin).createBounty("Fix bug", "Kit-A-M1", 1, ethers.parseEther("50"), 500);
    await vault.connect(alice).claimBounty(1);
    await expect(
      vault.connect(bob).submitBounty(1, ethers.keccak256(ethers.toUtf8Bytes("pr")))
    ).to.be.revertedWithCustomError(vault, "NotTheClaimer");
  });

  it("blocks approving a bounty that hasn't been submitted", async function () {
    await vault.connect(admin).createBounty("Fix bug", "Kit-A-M1", 1, ethers.parseEther("50"), 500);
    await expect(vault.connect(admin).approveBounty(1)).to.be.revertedWithCustomError(vault, "BountyNotSubmitted");
  });

  it("reverts approval if the vault is underfunded", async function () {
    await vault.connect(admin).createBounty("Big bounty", "Kit-A-M1", 1, ethers.parseEther("5000"), 500);
    await vault.connect(alice).claimBounty(1);
    await vault.connect(alice).submitBounty(1, ethers.keccak256(ethers.toUtf8Bytes("pr")));
    await expect(vault.connect(admin).approveBounty(1)).to.be.revertedWithCustomError(vault, "InsufficientVaultBalance");
  });
});
