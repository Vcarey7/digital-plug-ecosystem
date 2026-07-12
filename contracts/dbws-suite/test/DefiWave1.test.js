const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ForgeVault", function () {
  let vault, usdc, admin, spender, outside;

  beforeEach(async function () {
    [admin, spender, outside] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const ForgeVault = await ethers.getContractFactory("ForgeVault");
    vault = await ForgeVault.deploy(admin.address);
    await usdc.transfer(await vault.getAddress(), 1_000_000n);
  });

  it("lets SPENDER_ROLE move funds and blocks everyone else", async function () {
    await vault.spend(await usdc.getAddress(), outside.address, 1000n);
    expect(await usdc.balanceOf(outside.address)).to.equal(1000n);
    await expect(vault.connect(outside).spend(await usdc.getAddress(), outside.address, 1000n)).to.be.reverted;
  });
});

describe("InsuranceFund", function () {
  let fund, usdc, admin, other;

  beforeEach(async function () {
    [admin, other] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const InsuranceFund = await ethers.getContractFactory("InsuranceFund");
    fund = await InsuranceFund.deploy(await usdc.getAddress(), 100_000n, admin.address);
    await usdc.transfer(await fund.getAddress(), 1_000_000n);
  });

  it("requires 2 approvals and respects the minimum balance floor", async function () {
    await fund.fileClaim(other.address, 500_000n, "exploit-1");
    await expect(fund.payClaim(1)).to.be.revertedWithCustomError(fund, "NotEnoughApprovals");
    await fund.approveClaim(1);
    await expect(fund.approveClaim(1)).to.be.revertedWithCustomError(fund, "AlreadyApproved");

    const [, , second] = await ethers.getSigners();
    await fund.grantRole(await fund.APPROVER_ROLE(), second.address);
    await fund.connect(second).approveClaim(1);

    await fund.payClaim(1);
    expect(await usdc.balanceOf(other.address)).to.equal(500_000n);
  });

  it("blocks a claim that would breach the minimum balance", async function () {
    await fund.fileClaim(other.address, 950_000n, "too-big");
    await fund.approveClaim(1);
    const [, , second] = await ethers.getSigners();
    await fund.grantRole(await fund.APPROVER_ROLE(), second.address);
    await fund.connect(second).approveClaim(1);
    await expect(fund.payClaim(1)).to.be.revertedWithCustomError(fund, "BelowMinimum");
  });
});

describe("FamilyBankingVault", function () {
  let vault, usdc, admin, head, member, beneficiary;

  beforeEach(async function () {
    [admin, head, member, beneficiary] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const FamilyBankingVault = await ethers.getContractFactory("FamilyBankingVault");
    vault = await FamilyBankingVault.deploy(await usdc.getAddress(), admin.address);

    await usdc.transfer(head.address, 1_000_000n);
    await usdc.connect(head).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(head).createVault(30 * 24 * 60 * 60);
    await vault.connect(head).deposit(1, 500_000n);
  });

  it("lets a member draw their allowance once ready, and blocks early re-draw", async function () {
    await vault.connect(head).setMember(1, member.address, 10_000n, 7 * 24 * 60 * 60);
    await vault.connect(member).drawAllowance(1);
    expect(await usdc.balanceOf(member.address)).to.equal(10_000n);
    await expect(vault.connect(member).drawAllowance(1)).to.be.revertedWithCustomError(vault, "AllowanceNotReady");
  });

  it("schedules inheritance and only unlocks after unlockTime AND missed check-in", async function () {
    await vault.connect(head).scheduleInheritance(1, beneficiary.address, 100_000n, (await ethers.provider.getBlock("latest")).timestamp + 100);
    await expect(vault.connect(beneficiary).claimInheritance(1, 0)).to.be.revertedWithCustomError(vault, "InheritanceLocked");

    await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await vault.connect(beneficiary).claimInheritance(1, 0);
    expect(await usdc.balanceOf(beneficiary.address)).to.equal(100_000n);
  });

  it("lets the head withdraw freely up to balance", async function () {
    await vault.connect(head).headWithdraw(1, 200_000n);
    expect(await usdc.balanceOf(head.address)).to.equal(1_000_000n - 500_000n + 200_000n);
  });
});

describe("FlashLoanArbitrage (smoke — owner-only tool, no live Aave pool)", function () {
  let arb, admin, outsider;

  beforeEach(async function () {
    [admin, outsider] = await ethers.getSigners();
    const FlashLoanArbitrage = await ethers.getContractFactory("FlashLoanArbitrage");
    // A placeholder pool address is fine: these tests only exercise access control.
    arb = await FlashLoanArbitrage.deploy(admin.address, admin.address);
  });

  it("blocks non-owners from triggering an arbitrage", async function () {
    const params = { routerA: admin.address, routerB: admin.address, pathA: [], pathB: [], minProfit: 0 };
    await expect(
      arb.connect(outsider).executeArbitrage(admin.address, 1000, params)
    ).to.be.reverted;
  });

  it("rejects executeOperation callbacks from anything but the pool", async function () {
    const params = { routerA: admin.address, routerB: admin.address, pathA: [], pathB: [], minProfit: 0 };
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["tuple(address routerA,address routerB,address[] pathA,address[] pathB,uint256 minProfit)"],
      [params]
    );
    await expect(
      arb.connect(outsider).executeOperation(admin.address, 1000, 1, await arb.getAddress(), encoded)
    ).to.be.revertedWithCustomError(arb, "NotPool");
  });
});
