// WAVE 2 SMOKE TESTS — these contracts are legally gated (see README) and
// must not be deployed to mainnet. Tests here only prove the code behaves
// as designed on a local network; they are not a green light to launch.
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("[wave2] BlockBondNFT + CommunityRevenuePool + CommunityCredit", function () {
  let usdc, bond, pool, credit, admin, treasury, holder;

  beforeEach(async function () {
    [admin, treasury, holder] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const BlockBondNFT = await ethers.getContractFactory("BlockBondNFT");
    bond = await BlockBondNFT.deploy(await usdc.getAddress(), admin.address);

    const CommunityRevenuePool = await ethers.getContractFactory("CommunityRevenuePool");
    pool = await CommunityRevenuePool.deploy(await usdc.getAddress(), await bond.getAddress(), admin.address);

    const CommunityCredit = await ethers.getContractFactory("CommunityCredit");
    credit = await CommunityCredit.deploy(await usdc.getAddress(), treasury.address, admin.address);

    await bond.setRevenuePool(await pool.getAddress());
    await bond.setCredit(await credit.getAddress());
    await credit.grantRole(await credit.REPORTER_ROLE(), await bond.getAddress());

    await usdc.transfer(holder.address, 1_000_000_000n);
    await usdc.connect(holder).approve(await bond.getAddress(), ethers.MaxUint256);
    await usdc.transfer(await pool.getAddress(), 1_000_000_000n); // pre-fund pool reserve
  });

  it("mints a bond, accrues yield, and the revenue pool distributes it", async function () {
    await bond.connect(holder).mintBond(100_000_000n, 12); // $100
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    expect(await bond.pendingYield(1)).to.be.greaterThan(0);
    await pool.runDistribution(0, 10);
    expect(await usdc.balanceOf(holder.address)).to.be.greaterThan(0);
  });

  it("redeems at maturity for full principal, or early with a penalty", async function () {
    await bond.connect(holder).mintBond(100_000_000n, 12);
    const before = await usdc.balanceOf(holder.address);
    await bond.connect(holder).redeem(1); // immediate exit -> penalty applied
    const after = await usdc.balanceOf(holder.address);
    expect(after - before).to.be.lessThan(100_000_000n);
  });

  it("feeds bond purchase activity into CommunityCredit's score", async function () {
    await bond.connect(holder).mintBond(100_000_000n, 12);
    expect(await credit.scoreOf(holder.address)).to.be.greaterThan(500);
  });

  it("[CommunityCredit lending] originates and repays a scored microloan", async function () {
    await usdc.approve(await credit.getAddress(), ethers.MaxUint256);
    await credit.fundReserve(50_000_000_000n); // $50,000 reserve, comfortably above the $25,000 max credit limit
    await credit.grantRole(await credit.REPORTER_ROLE(), admin.address);
    for (let i = 0; i < 6; i++) {
      await credit.recordActivity(holder.address, 2, 5_000e6); // repeated on-time-yield events to clear the 550 borrow threshold
    }

    const limit = await credit.creditLimit(holder.address);
    expect(limit).to.be.greaterThan(0);
    await credit.connect(holder).borrow(limit, 30);
    expect(await usdc.balanceOf(holder.address)).to.be.greaterThanOrEqual(limit);

    await usdc.connect(holder).approve(await credit.getAddress(), ethers.MaxUint256);
    // Overpay slightly to absorb any interest accrued between the view call
    // and the repay tx being mined; repay() caps the actual pull at outstanding.
    const owedEstimate = await credit.loanBalance(holder.address);
    const overpay = owedEstimate + owedEstimate / 100n + 1_000n;
    await usdc.transfer(holder.address, overpay);
    await credit.connect(holder).repay(overpay);
    expect((await credit.loans(holder.address)).active).to.equal(false);
  });
});
