const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NerdTVContentRegistry + NerdTVRoyalty", function () {
  let registry, royalty, usdc, admin, treasury, communityPool, creator, payer;

  beforeEach(async function () {
    [admin, treasury, communityPool, creator, payer] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const NerdTVContentRegistry = await ethers.getContractFactory("NerdTVContentRegistry");
    registry = await NerdTVContentRegistry.deploy(admin.address);

    const NerdTVRoyalty = await ethers.getContractFactory("NerdTVRoyalty");
    royalty = await NerdTVRoyalty.deploy(
      await usdc.getAddress(),
      await registry.getAddress(),
      treasury.address,
      communityPool.address,
      admin.address
    );

    await registry.publish(creator.address, 0, ethers.encodeBytes32String("hash"), 6000, 2500); // 60/25/15
    await usdc.transfer(payer.address, 1_000_000n);
    await usdc.connect(payer).approve(await royalty.getAddress(), ethers.MaxUint256);
  });

  it("splits royalty payments across creator, platform, and community per the registry config", async function () {
    await royalty.connect(payer).receiveRoyalty(1, 100_000n);
    expect(await usdc.balanceOf(treasury.address)).to.equal(25_000n);
    expect(await usdc.balanceOf(communityPool.address)).to.equal(15_000n);
    await royalty.connect(creator).withdraw();
    expect(await usdc.balanceOf(creator.address)).to.equal(60_000n);
  });

  it("blocks royalty payments for deactivated content", async function () {
    await registry.deactivate(1);
    await expect(royalty.connect(payer).receiveRoyalty(1, 1000n)).to.be.revertedWithCustomError(
      royalty,
      "ContentInactive"
    );
  });
});

describe("WatchToEarn", function () {
  let watch, plug, admin, treasury, viewer;

  beforeEach(async function () {
    [admin, treasury, viewer] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(treasury.address, admin.address);
    const WatchToEarn = await ethers.getContractFactory("WatchToEarn");
    watch = await WatchToEarn.deploy(await plug.getAddress(), treasury.address, admin.address);
    await plug.connect(treasury).approve(await watch.getAddress(), ethers.MaxUint256);
  });

  it("pays PLUG per minute watched and caps at the daily limit", async function () {
    await watch.rewardWatch(viewer.address, 60);
    expect(await plug.balanceOf(viewer.address)).to.equal(ethers.parseEther("6")); // 60 * 0.1

    await watch.rewardWatch(viewer.address, 1000); // way over remaining daily cap
    const cap = await watch.dailyCapMinutes();
    expect(await plug.balanceOf(viewer.address)).to.equal(cap * 10n ** 17n);
  });

  it("blocks further rewards once the daily cap is fully used", async function () {
    await watch.rewardWatch(viewer.address, 240); // full daily cap
    await expect(watch.rewardWatch(viewer.address, 1)).to.be.revertedWithCustomError(watch, "DailyCapReached");
  });
});
