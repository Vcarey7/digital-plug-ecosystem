// WAVE 2 SMOKE TESTS — see README for the legal-hold list. Local-only proof
// of correctness, not a deployment green light.
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("[wave2] PredictionMarket + PredictionOracle", function () {
  let market, oracle, plug, gplug, admin, treasury, alice, bob;

  beforeEach(async function () {
    [admin, treasury, alice, bob] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const GPlugToken = await ethers.getContractFactory("GPlugToken");
    gplug = await GPlugToken.deploy(admin.address);

    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    market = await PredictionMarket.deploy(await gplug.getAddress(), await plug.getAddress(), treasury.address, admin.address);

    const PredictionOracle = await ethers.getContractFactory("PredictionOracle");
    oracle = await PredictionOracle.deploy(await market.getAddress(), admin.address);
    await market.grantRole(await market.ORACLE_ROLE(), await oracle.getAddress());

    await plug.transfer(alice.address, ethers.parseEther("1000"));
    await plug.transfer(bob.address, ethers.parseEther("1000"));
    await plug.connect(alice).approve(await market.getAddress(), ethers.MaxUint256);
    await plug.connect(bob).approve(await market.getAddress(), ethers.MaxUint256);
  });

  it("runs a parimutuel market end to end: stake, resolve via oracle, claim winnings", async function () {
    const closeTime = (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await market.createMarket("Will it rain?", closeTime);
    await market.connect(alice).stake(1, true, 0, ethers.parseEther("100")); // YES
    await market.connect(bob).stake(1, false, 0, ethers.parseEther("100")); // NO

    await ethers.provider.send("evm_increaseTime", [1001]);
    await ethers.provider.send("evm_mine");
    await oracle.report(1, 1); // YES

    const before = await plug.balanceOf(alice.address);
    await market.connect(alice).claim(1);
    expect(await plug.balanceOf(alice.address)).to.be.greaterThan(before);
    // Losing side gets nothing.
    await market.connect(bob).claim(1);
  });

  it("fully refunds both sides on an INVALID resolution", async function () {
    const closeTime = (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await market.createMarket("Ambiguous event", closeTime);
    await market.connect(alice).stake(1, true, 0, ethers.parseEther("50"));
    await ethers.provider.send("evm_increaseTime", [1001]);
    await ethers.provider.send("evm_mine");
    await oracle.report(1, 3); // INVALID
    const before = await plug.balanceOf(alice.address);
    await market.connect(alice).claim(1);
    expect(await plug.balanceOf(alice.address)).to.equal(before + ethers.parseEther("50"));
  });
});

describe("[wave2] PlugStaking + InvoiceToken + TournamentPrizePool", function () {
  it("PlugStaking pays reward-reserve-funded yield over time", async function () {
    const [admin, alice] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    const plug = await PlugToken.deploy(admin.address, admin.address);
    const PlugStaking = await ethers.getContractFactory("PlugStaking");
    const staking = await PlugStaking.deploy(await plug.getAddress(), admin.address);

    await plug.approve(await staking.getAddress(), ethers.MaxUint256);
    await staking.fundReserve(ethers.parseEther("1000"));
    await staking.setRewardRate(ethers.parseEther("1"));

    await plug.transfer(alice.address, ethers.parseEther("100"));
    await plug.connect(alice).approve(await staking.getAddress(), ethers.MaxUint256);
    await staking.connect(alice).stake(ethers.parseEther("100"));

    await ethers.provider.send("evm_increaseTime", [100]);
    await ethers.provider.send("evm_mine");
    await staking.connect(alice).harvest();
    expect(await plug.balanceOf(alice.address)).to.be.greaterThan(0);
  });

  it("InvoiceToken funds a business and pays investors principal + discount on settlement", async function () {
    const [admin, business, investor] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    const InvoiceToken = await ethers.getContractFactory("InvoiceToken");
    const invoice = await InvoiceToken.deploy(await usdc.getAddress(), admin.address);
    await invoice.grantRole(await invoice.ISSUER_ROLE(), business.address);

    await usdc.transfer(investor.address, 1_000_000n);
    await usdc.connect(investor).approve(await invoice.getAddress(), ethers.MaxUint256);
    await usdc.transfer(business.address, 1_000_000n);
    await usdc.connect(business).approve(await invoice.getAddress(), ethers.MaxUint256);

    const dueDate = (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await invoice.connect(business).listInvoice(110_000n, 100_000n, dueDate);
    await invoice.connect(investor).invest(1, 100_000n);
    expect(await usdc.balanceOf(business.address)).to.be.greaterThan(1_000_000n - 100_000n); // received discounted proceeds

    await invoice.connect(business).settle(1);
    const before = await usdc.balanceOf(investor.address);
    await invoice.connect(investor).redeem(1);
    expect(await usdc.balanceOf(investor.address)).to.equal(before + 110_000n);
  });

  it("TournamentPrizePool escrows entries and splits the pot on settlement", async function () {
    const [admin, treasury, p1, p2] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    const TournamentPrizePool = await ethers.getContractFactory("TournamentPrizePool");
    const pool = await TournamentPrizePool.deploy(treasury.address, admin.address);

    await usdc.transfer(p1.address, 1_000_000n);
    await usdc.transfer(p2.address, 1_000_000n);
    await usdc.connect(p1).approve(await pool.getAddress(), ethers.MaxUint256);
    await usdc.connect(p2).approve(await pool.getAddress(), ethers.MaxUint256);

    const closeTime = (await ethers.provider.getBlock("latest")).timestamp + 1000;
    await pool.createTournament(await usdc.getAddress(), 100_000n, closeTime, [8_000, 2_000], 0);
    await pool.connect(p1).enter(1);
    await pool.connect(p2).enter(1);

    await pool.settle(1, [p1.address, p2.address]);
    expect(await usdc.balanceOf(p1.address)).to.equal(1_000_000n - 100_000n + 160_000n);
    expect(await usdc.balanceOf(p2.address)).to.equal(1_000_000n - 100_000n + 40_000n);
  });
});

describe("[wave2] PlugBridge", function () {
  it("locks PLUG on this side and lets a relayer unlock with replay protection", async function () {
    const [admin, relayer, alice, bob] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    const plug = await PlugToken.deploy(admin.address, admin.address);
    const PlugBridge = await ethers.getContractFactory("PlugBridge");
    const bridge = await PlugBridge.deploy(await plug.getAddress(), admin.address);
    await bridge.grantRole(await bridge.RELAYER_ROLE(), relayer.address);

    await plug.transfer(alice.address, ethers.parseEther("100"));
    await plug.connect(alice).approve(await bridge.getAddress(), ethers.MaxUint256);
    await bridge.connect(alice).lock(137, ethers.zeroPadValue(bob.address, 32), ethers.parseEther("50"));

    const messageId = ethers.keccak256(ethers.toUtf8Bytes("msg-1"));
    await bridge.connect(relayer).unlock(messageId, bob.address, ethers.parseEther("50"));
    expect(await plug.balanceOf(bob.address)).to.equal(ethers.parseEther("50"));

    await expect(
      bridge.connect(relayer).unlock(messageId, bob.address, ethers.parseEther("50"))
    ).to.be.revertedWithCustomError(bridge, "AlreadyProcessed");
  });
});
