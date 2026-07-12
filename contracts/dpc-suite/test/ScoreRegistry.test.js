const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ScoreRegistry", function () {
  let registry, admin, alice, lender;

  beforeEach(async function () {
    [admin, alice, lender] = await ethers.getSigners();
    const ScoreRegistry = await ethers.getContractFactory("ScoreRegistry");
    registry = await ScoreRegistry.deploy(admin.address);
    await registry.waitForDeployment();
  });

  it("computes a weighted score from behavioral factors", async function () {
    await registry.connect(admin).updateFactors(alice.address, 100, 100, 100, 100, 100, 100);
    // All factors maxed -> composite 100 -> top of the 300-850 range
    expect(await registry.connect(alice).myScore()).to.equal(850);
  });

  it("weights payment consistency the heaviest (35%)", async function () {
    // Only paymentConsistency maxed, everything else 0
    await registry.connect(admin).updateFactors(alice.address, 100, 0, 0, 0, 0, 0);
    const score = await registry.connect(alice).myScore();
    // composite = 3500/10000 = 35 -> 300 + 35*5.5 = 492.5 -> 492
    expect(score).to.equal(492);
  });

  it("blocks non-oracle addresses from updating factors", async function () {
    await expect(
      registry.connect(alice).updateFactors(alice.address, 100, 100, 100, 100, 100, 100)
    ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
  });

  it("blocks a lender from querying a score without consent", async function () {
    await registry.connect(admin).updateFactors(alice.address, 100, 100, 100, 100, 100, 100);
    await expect(registry.connect(lender).queryScore(alice.address)).to.be.revertedWithCustomError(
      registry,
      "NoConsent"
    );
  });

  it("lets a wallet grant and revoke lender consent", async function () {
    await registry.connect(admin).updateFactors(alice.address, 100, 100, 100, 100, 100, 100);
    await registry.connect(alice).grantConsent(lender.address);
    expect(await registry.connect(lender).queryScore.staticCall(alice.address)).to.equal(850);

    await registry.connect(alice).revokeConsent(lender.address);
    await expect(registry.connect(lender).queryScore(alice.address)).to.be.revertedWithCustomError(
      registry,
      "NoConsent"
    );
  });

  it("open consent allows any lender to query", async function () {
    await registry.connect(admin).updateFactors(alice.address, 100, 100, 100, 100, 100, 100);
    await registry.connect(alice).setOpenConsent(true);
    expect(await registry.connect(lender).queryScore.staticCall(alice.address)).to.equal(850);
  });

  it("tracks rolling score history", async function () {
    await registry.connect(admin).updateFactors(alice.address, 50, 50, 50, 50, 50, 50);
    await registry.connect(admin).updateFactors(alice.address, 100, 100, 100, 100, 100, 100);
    const history = await registry.connect(alice).getScoreHistory(alice.address);
    expect(history[0]).to.be.greaterThan(0);
    expect(history[1]).to.equal(850);
  });
});
