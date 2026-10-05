const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HomeschoolVault", function () {
  let vault, usdc, admin, guardian, child;

  beforeEach(async function () {
    [admin, guardian, child] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const HomeschoolVault = await ethers.getContractFactory("HomeschoolVault");
    vault = await HomeschoolVault.deploy(await usdc.getAddress(), admin.address);

    await usdc.transfer(guardian.address, 1_000_000n);
    await usdc.connect(guardian).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  it("splits balance evenly across remaining milestones as they're released", async function () {
    await vault.connect(guardian).createPlan(child.address, 4);
    await vault.connect(guardian).fund(1, 400_000n);
    await vault.releaseMilestone(1); // 400k/4 = 100k
    expect(await usdc.balanceOf(child.address)).to.equal(100_000n);
    await vault.releaseMilestone(1); // 300k/3 = 100k
    expect(await usdc.balanceOf(child.address)).to.equal(200_000n);
  });

  it("blocks releasing past the milestone total", async function () {
    await vault.connect(guardian).createPlan(child.address, 1);
    await vault.connect(guardian).fund(1, 100_000n);
    await vault.releaseMilestone(1);
    await expect(vault.releaseMilestone(1)).to.be.revertedWithCustomError(vault, "AllMilestonesDone");
  });
});

describe("TeacherRetentionFund", function () {
  let fund, usdc, plug, admin, teacher;

  beforeEach(async function () {
    [admin, teacher] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const TeacherRetentionFund = await ethers.getContractFactory("TeacherRetentionFund");
    fund = await TeacherRetentionFund.deploy(await usdc.getAddress(), await plug.getAddress(), admin.address);

    await usdc.approve(await fund.getAddress(), ethers.MaxUint256);
    await plug.approve(await fund.getAddress(), ethers.MaxUint256);
    await fund.fund(1_000_000n, ethers.parseEther("1000"));
  });

  it("vests a milestone by timestamp and pays both USDC and PLUG bonuses", async function () {
    const vestAt = (await ethers.provider.getBlock("latest")).timestamp + 100;
    await fund.addMilestone(teacher.address, vestAt, 50_000n, ethers.parseEther("10"));
    await expect(fund.connect(teacher).claim(0)).to.be.revertedWithCustomError(fund, "NotVested");
    await ethers.provider.send("evm_increaseTime", [101]);
    await ethers.provider.send("evm_mine");
    await fund.connect(teacher).claim(0);
    expect(await usdc.balanceOf(teacher.address)).to.equal(50_000n);
    expect(await plug.balanceOf(teacher.address)).to.equal(ethers.parseEther("10"));
  });
});

describe("EducationVault", function () {
  let vault, usdc, admin, donor, recipient;

  beforeEach(async function () {
    [admin, donor, recipient] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const EducationVault = await ethers.getContractFactory("EducationVault");
    vault = await EducationVault.deploy(await usdc.getAddress(), admin.address);

    await usdc.transfer(donor.address, 1_000_000n);
    await usdc.connect(donor).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(donor).donate(1_000_000n);
  });

  it("reserves an award and lets the recipient claim within the window", async function () {
    const claimBy = (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await vault.award(recipient.address, 100_000n, claimBy);
    await vault.connect(recipient).claim(1);
    expect(await usdc.balanceOf(recipient.address)).to.equal(100_000n);
  });

  it("blocks awarding more than the unreserved free balance", async function () {
    const claimBy = (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await vault.award(recipient.address, 1_000_000n, claimBy);
    await expect(vault.award(recipient.address, 1n, claimBy)).to.be.revertedWithCustomError(vault, "InsufficientFree");
  });

  it("lets an expired unclaimed award be reclaimed to the free pool", async function () {
    const claimBy = (await ethers.provider.getBlock("latest")).timestamp + 100;
    await vault.award(recipient.address, 100_000n, claimBy);
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine");
    await expect(vault.connect(recipient).claim(1)).to.be.revertedWithCustomError(vault, "ClaimWindowPassed");
    await vault.expireAward(1);
    // Now the full 1,000,000 balance is free again.
    const newClaimBy = (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await vault.award(recipient.address, 1_000_000n, newClaimBy);
  });
});
