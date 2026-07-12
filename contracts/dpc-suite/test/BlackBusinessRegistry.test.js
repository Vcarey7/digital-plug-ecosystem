const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BlackBusinessRegistry", function () {
  let plug, registry, admin, alice, bob, buyer;
  const STAKE = ethers.parseEther("100");

  beforeEach(async function () {
    [admin, alice, bob, buyer] = await ethers.getSigners();

    const MockPlugToken = await ethers.getContractFactory("MockPlugToken");
    plug = await MockPlugToken.deploy();
    await plug.waitForDeployment();

    const BlackBusinessRegistry = await ethers.getContractFactory("BlackBusinessRegistry");
    registry = await BlackBusinessRegistry.deploy(await plug.getAddress(), admin.address, admin.address);
    await registry.waitForDeployment();

    for (const user of [alice, buyer]) {
      await plug.connect(admin).transfer(user.address, ethers.parseEther("10000"));
      await plug.connect(user).approve(await registry.getAddress(), ethers.parseEther("10000"));
    }
  });

  it("registers a business, requires 2-of-3 validator approval, then mints a badge", async function () {
    await registry.connect(alice).registerBusiness("Alice's Bakery", "Food", "ipfs://docs", "Columbus, OH");

    const [, v1, v2] = await ethers.getSigners();
    await registry.connect(admin).grantRole(await registry.VALIDATOR_ROLE(), v1.address);
    await registry.connect(admin).grantRole(await registry.VALIDATOR_ROLE(), v2.address);

    await registry.connect(admin).vote(1, true);
    let business = await registry.getBusiness(1);
    expect(business.status).to.equal(1); // still PENDING (1-of-2)

    await registry.connect(v1).vote(1, true);
    business = await registry.getBusiness(1);
    expect(business.status).to.equal(2); // VERIFIED
    expect(await registry.ownerOf(1)).to.equal(alice.address);
  });

  it("returns half the stake on rejection", async function () {
    await registry.connect(alice).registerBusiness("Sketchy LLC", "Other", "ipfs://docs", "Nowhere");
    const [, v1, v2] = await ethers.getSigners();
    await registry.connect(admin).grantRole(await registry.VALIDATOR_ROLE(), v1.address);
    await registry.connect(admin).grantRole(await registry.VALIDATOR_ROLE(), v2.address);

    const balanceBefore = await plug.balanceOf(alice.address);
    await registry.connect(admin).vote(1, false);
    await registry.connect(v1).vote(1, false);
    const balanceAfter = await plug.balanceOf(alice.address);

    expect(balanceAfter - balanceBefore).to.equal(STAKE / 2n);
    const business = await registry.getBusiness(1);
    expect(business.status).to.equal(4); // REJECTED
  });

  it("blocks a second registration from the same owner", async function () {
    await registry.connect(alice).registerBusiness("Alice's Bakery", "Food", "ipfs://docs", "Columbus, OH");
    await expect(
      registry.connect(alice).registerBusiness("Alice's Second Shop", "Food", "ipfs://docs2", "Columbus, OH")
    ).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
  });

  it("records spend, takes the platform fee, and updates reputation", async function () {
    await registry.connect(alice).registerBusiness("Alice's Bakery", "Food", "ipfs://docs", "Columbus, OH");
    const [, v1, v2] = await ethers.getSigners();
    await registry.connect(admin).grantRole(await registry.VALIDATOR_ROLE(), v1.address);
    await registry.connect(admin).vote(1, true);
    await registry.connect(v1).vote(1, true);

    const spend = ethers.parseEther("1000");
    const businessBalanceBefore = await plug.balanceOf(alice.address);
    const feeBalanceBefore = await plug.balanceOf(admin.address);

    await registry.connect(buyer).recordSpend(1, spend);

    const businessBalanceAfter = await plug.balanceOf(alice.address);
    const feeBalanceAfter = await plug.balanceOf(admin.address);

    const expectedFee = (spend * 50n) / 10000n;
    expect(feeBalanceAfter - feeBalanceBefore).to.equal(expectedFee);
    expect(businessBalanceAfter - businessBalanceBefore).to.equal(spend - expectedFee);
    expect(await registry.hasVerifiedPurchase(buyer.address, 1)).to.equal(true);
  });

  it("blocks stake withdrawal before the 180-day lock expires", async function () {
    await registry.connect(alice).registerBusiness("Alice's Bakery", "Food", "ipfs://docs", "Columbus, OH");
    const [, v1, v2] = await ethers.getSigners();
    await registry.connect(admin).grantRole(await registry.VALIDATOR_ROLE(), v1.address);
    await registry.connect(admin).vote(1, true);
    await registry.connect(v1).vote(1, true);

    await expect(registry.connect(alice).withdrawStake(1)).to.be.revertedWithCustomError(registry, "StakeLocked");

    await time.increase(180 * 24 * 60 * 60 + 1);
    await registry.connect(alice).withdrawStake(1);
  });

  it("blocks transfers -- the verification badge is soulbound", async function () {
    await registry.connect(alice).registerBusiness("Alice's Bakery", "Food", "ipfs://docs", "Columbus, OH");
    const [, v1] = await ethers.getSigners();
    await registry.connect(admin).grantRole(await registry.VALIDATOR_ROLE(), v1.address);
    await registry.connect(admin).vote(1, true);
    await registry.connect(v1).vote(1, true);

    await expect(registry.connect(alice).transferFrom(alice.address, bob.address, 1)).to.be.revertedWith(
      "Soulbound: non-transferable"
    );
  });
});
