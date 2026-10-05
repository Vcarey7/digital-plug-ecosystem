const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("InheritanceVault", function () {
  let vault, owner, guardian1, guardian2, guardian3, beneficiary;
  const INACTIVITY_WINDOW = 180 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, guardian1, guardian2, guardian3, beneficiary] = await ethers.getSigners();
    const InheritanceVault = await ethers.getContractFactory("InheritanceVault");
    vault = await InheritanceVault.deploy(owner.address, "Test Vault", INACTIVITY_WINDOW, 3);
    await vault.waitForDeployment();

    await vault.connect(owner).addGuardian(guardian1.address);
    await vault.connect(owner).addGuardian(guardian2.address);
    await vault.connect(owner).addGuardian(guardian3.address);
    await vault.connect(owner).addBeneficiary(beneficiary.address, 10000, 0 /* IMMEDIATE */, 0);

    // Fund the vault with native currency
    await owner.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("10") });
  });

  it("lets the owner ping to reset the inactivity clock", async function () {
    const before = await vault.lastOwnerPing();
    await time.increase(1000);
    await vault.connect(owner).ping();
    const after = await vault.lastOwnerPing();
    expect(after).to.be.greaterThan(before);
  });

  it("rejects death confirmation before the inactivity window elapses", async function () {
    await expect(vault.connect(guardian1).confirmDeath(0)).to.be.revertedWith("Inactivity window not elapsed");
  });

  it("reaches quorum, opens a challenge window, then executes and distributes assets", async function () {
    await time.increase(INACTIVITY_WINDOW + 1);

    await vault.connect(guardian1).confirmDeath(0);
    await vault.connect(guardian2).confirmDeath(1);
    let state = await vault.state();
    expect(state).to.equal(0); // still ACTIVE (2-of-3, quorum is 3)

    await vault.connect(guardian3).confirmDeath(2);
    state = await vault.state();
    expect(state).to.equal(1); // CHALLENGED

    await expect(vault.executeVault()).to.be.revertedWithCustomError(vault, "ChallengeWindowOpen");

    await time.increase(48 * 60 * 60 + 1);

    const balanceBefore = await ethers.provider.getBalance(beneficiary.address);
    await vault.executeVault();
    const balanceAfter = await ethers.provider.getBalance(beneficiary.address);

    // Beneficiary gets 100% (10000 bps) minus the 1% platform fee
    const expected = (ethers.parseEther("10") * 9900n) / 10000n;
    expect(balanceAfter - balanceBefore).to.equal(expected);
  });

  it("lets the owner reclaim the vault with proof of life during the challenge window", async function () {
    await time.increase(INACTIVITY_WINDOW + 1);
    await vault.connect(guardian1).confirmDeath(0);
    await vault.connect(guardian2).confirmDeath(1);
    await vault.connect(guardian3).confirmDeath(2);
    expect(await vault.state()).to.equal(1); // CHALLENGED

    await vault.connect(owner).submitProofOfLife();
    expect(await vault.state()).to.equal(0); // back to ACTIVE

    await expect(vault.executeVault()).to.be.revertedWithCustomError(vault, "QuorumNotReached");
  });

  it("rejects proof of life submitted after the challenge window closes", async function () {
    await time.increase(INACTIVITY_WINDOW + 1);
    await vault.connect(guardian1).confirmDeath(0);
    await vault.connect(guardian2).confirmDeath(1);
    await vault.connect(guardian3).confirmDeath(2);

    await time.increase(48 * 60 * 60 + 1);
    await expect(vault.connect(owner).submitProofOfLife()).to.be.revertedWithCustomError(
      vault,
      "ChallengeWindowClosed"
    );
  });

  it("rejects a non-guardian confirming death", async function () {
    await time.increase(INACTIVITY_WINDOW + 1);
    await expect(vault.connect(beneficiary).confirmDeath(0)).to.be.revertedWith("Not this guardian");
  });
});
