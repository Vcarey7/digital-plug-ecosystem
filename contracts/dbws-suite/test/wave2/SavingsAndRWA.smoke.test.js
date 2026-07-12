// WAVE 2 SMOKE TESTS — see README for the legal-hold list. Local-only proof
// of correctness, not a deployment green light.
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("[wave2] SavingsVault", function () {
  let vault, usdc, admin, alice;

  beforeEach(async function () {
    [admin, alice] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const SavingsVault = await ethers.getContractFactory("SavingsVault");
    vault = await SavingsVault.deploy(await usdc.getAddress(), admin.address);

    await usdc.approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.fundReserve(1_000_000_000n);

    await usdc.transfer(alice.address, 1_000_000_000n);
    await usdc.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  it("locks a term deposit and pays principal + accrued APY on withdrawal", async function () {
    await vault.connect(alice).deposit(100_000_000n, 3); // D365, 14% APY
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    const before = await usdc.balanceOf(alice.address);
    await vault.connect(alice).withdraw(0);
    const after = await usdc.balanceOf(alice.address);
    expect(after - before).to.be.greaterThan(100_000_000n); // principal + yield
  });

  it("blocks withdrawing a locked term deposit before unlock", async function () {
    await vault.connect(alice).deposit(100_000_000n, 1); // D90
    await expect(vault.connect(alice).withdraw(0)).to.be.revertedWithCustomError(vault, "StillLocked");
  });
});

describe("[wave2] RWAVault", function () {
  let vault, usdc, admin, issuer, holder;

  beforeEach(async function () {
    [admin, issuer, holder] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const RWAVault = await ethers.getContractFactory("RWAVault");
    vault = await RWAVault.deploy(await usdc.getAddress(), "ipfs://rwa/", admin.address);

    await vault.setKYC(holder.address, true);
    await vault.tokenize(holder.address, "ipfs://deed.pdf", 1000);

    await usdc.approve(await vault.getAddress(), ethers.MaxUint256);
  });

  it("distributes revenue pro-rata to fractional shareholders and lets them claim", async function () {
    await vault.distributeRevenue(1, 100_000n);
    expect(await vault.pendingRevenue(1, holder.address)).to.equal(100_000n); // sole holder
    const before = await usdc.balanceOf(holder.address);
    await vault.connect(holder).claim(1);
    expect(await usdc.balanceOf(holder.address)).to.equal(before + 100_000n);
  });

  it("blocks transfers to a non-KYC'd address", async function () {
    const [, , , notKyc] = await ethers.getSigners();
    await expect(
      vault.connect(holder).safeTransferFrom(holder.address, notKyc.address, 1, 100, "0x")
    ).to.be.revertedWithCustomError(vault, "NotKYC");
  });
});
