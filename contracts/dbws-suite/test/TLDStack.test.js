const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TLDValuationOracle", function () {
  let oracle, admin;

  beforeEach(async function () {
    [admin] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("TLDValuationOracle");
    oracle = await Oracle.deploy(admin.address);
  });

  it("computes SFV from weighted metrics", async function () {
    const hash = await oracle.tldHash("plug");
    await oracle.updateMetrics(hash, ethers.parseEther("1000"), 10, ethers.parseEther("500"), 4, 80);
    // 1000 + 10*25 + 500*0.10 + 4*5 + 80*100 = 1000+250+50+20+8000 = 9320
    expect(await oracle.getSFVByName("plug")).to.equal(ethers.parseEther("9320"));
  });

  it("caps brandScore at 100 and blocks non-feeders", async function () {
    const [, notFeeder] = await ethers.getSigners();
    const hash = await oracle.tldHash("plug");
    await expect(
      oracle.connect(notFeeder).updateMetrics(hash, 0, 0, 0, 0, 50)
    ).to.be.reverted;
    await oracle.updateMetrics(hash, 0, 0, 0, 0, 255);
    const m = await oracle.metrics(hash);
    expect(m.brandScore).to.equal(100);
  });
});

describe("TLDPriceController", function () {
  let oracle, controller, admin;

  beforeEach(async function () {
    [admin] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("TLDValuationOracle");
    oracle = await Oracle.deploy(admin.address);
    const Controller = await ethers.getContractFactory("TLDPriceController");
    controller = await Controller.deploy(await oracle.getAddress());

    const hash = await oracle.tldHash("plug");
    await oracle.updateMetrics(hash, ethers.parseEther("1000"), 0, 0, 0, 0);
  });

  it("classifies listings into the correct tier by ratio to SFV", async function () {
    const hash = await oracle.tldHash("plug");
    let [tier] = await controller.previewListing(hash, ethers.parseEther("500")); // 50% -> FIRE_SALE
    expect(tier).to.equal(0);
    [tier] = await controller.previewListing(hash, ethers.parseEther("1000")); // 100% -> FLOOR
    expect(tier).to.equal(1);
    [tier] = await controller.previewListing(hash, ethers.parseEther("1500")); // 150% -> MARKET
    expect(tier).to.equal(2);
    [tier] = await controller.previewListing(hash, ethers.parseEther("3000")); // 300% -> PREMIUM
    expect(tier).to.equal(3);
    [tier] = await controller.previewListing(hash, ethers.parseEther("6000")); // 600% -> SPECULATIVE
    expect(tier).to.equal(4);
  });
});

describe("UserTLDRegistry", function () {
  let plug, tldRegistry, admin, treasury, alice;

  beforeEach(async function () {
    [admin, treasury, alice] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);

    const UserTLDRegistry = await ethers.getContractFactory("UserTLDRegistry");
    tldRegistry = await UserTLDRegistry.deploy(await plug.getAddress(), treasury.address, admin.address);

    await plug.transfer(alice.address, ethers.parseEther("1000000"));
    await plug.connect(alice).approve(await tldRegistry.getAddress(), ethers.MaxUint256);
  });

  it("charges the length-tiered mint price and mints the TLD NFT", async function () {
    const price5 = await tldRegistry.mintPrice("hustle"); // 6 chars -> base
    await tldRegistry.connect(alice).mintTLD("hustle", 500);
    expect(await tldRegistry.ownerOf(1)).to.equal(alice.address);
    expect(await plug.balanceOf(treasury.address)).to.equal(price5);

    const price3 = await tldRegistry.mintPrice("abc");
    expect(price3).to.equal(price5 * 10n);
  });

  it("rejects reserved and already-taken TLDs", async function () {
    await tldRegistry.setReserved("com", true);
    await expect(tldRegistry.connect(alice).mintTLD("com", 0)).to.be.revertedWithCustomError(
      tldRegistry,
      "TLDReserved"
    );
    await tldRegistry.connect(alice).mintTLD("hustle", 0);
    await expect(tldRegistry.connect(alice).mintTLD("hustle", 0)).to.be.revertedWithCustomError(
      tldRegistry,
      "TLDTaken"
    );
  });

  it("accrues and lets the TLD owner claim royalties", async function () {
    await tldRegistry.connect(alice).mintTLD("hustle", 1_000); // 10%
    await tldRegistry.grantRole(await tldRegistry.ROYALTY_REPORTER_ROLE(), admin.address);
    await plug.approve(await tldRegistry.getAddress(), ethers.MaxUint256);
    await tldRegistry.accrueRoyalty(1, ethers.parseEther("100"));
    expect(await tldRegistry.pendingRoyalties(1)).to.equal(ethers.parseEther("10"));

    const before = await plug.balanceOf(alice.address);
    await tldRegistry.connect(alice).claimRoyalties(1);
    expect(await plug.balanceOf(alice.address)).to.equal(before + ethers.parseEther("10"));
  });
});

describe("TLDAuctionEngine", function () {
  let plug, tldRegistry, auction, admin, treasury, alice, bob;

  beforeEach(async function () {
    [admin, treasury, alice, bob] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);

    const UserTLDRegistry = await ethers.getContractFactory("UserTLDRegistry");
    tldRegistry = await UserTLDRegistry.deploy(await plug.getAddress(), treasury.address, admin.address);

    const Auction = await ethers.getContractFactory("TLDAuctionEngine");
    auction = await Auction.deploy(await plug.getAddress(), treasury.address, admin.address);

    await plug.transfer(alice.address, ethers.parseEther("1000000"));
    await plug.transfer(bob.address, ethers.parseEther("1000000"));
    await plug.connect(alice).approve(await tldRegistry.getAddress(), ethers.MaxUint256);
    await plug.connect(alice).approve(await auction.getAddress(), ethers.MaxUint256);
    await plug.connect(bob).approve(await auction.getAddress(), ethers.MaxUint256);

    await tldRegistry.connect(alice).mintTLD("hustle", 0);
    await tldRegistry.connect(alice).setApprovalForAll(await auction.getAddress(), true);
  });

  it("runs an English auction to settlement with fee split", async function () {
    await auction.connect(alice).createAuction(
      await tldRegistry.getAddress(),
      1,
      0, // ENGLISH
      ethers.parseEther("100"),
      ethers.parseEther("100"), // reserve
      3600
    );
    await auction.connect(bob).bid(1, ethers.parseEther("150"));
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine");

    const treasuryBefore = await plug.balanceOf(treasury.address);
    await auction.settle(1);
    expect(await tldRegistry.ownerOf(1)).to.equal(bob.address);
    expect(await plug.balanceOf(treasury.address)).to.equal(
      treasuryBefore + (ethers.parseEther("150") * 250n) / 10_000n
    );
  });

  it("returns the NFT unsold if reserve isn't met", async function () {
    await auction.connect(alice).createAuction(
      await tldRegistry.getAddress(),
      1,
      0,
      ethers.parseEther("100"),
      ethers.parseEther("500"), // unreachable reserve
      3600
    );
    await auction.connect(bob).bid(1, ethers.parseEther("150"));
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine");
    await auction.settle(1);
    expect(await tldRegistry.ownerOf(1)).to.equal(alice.address);
  });

  it("runs a Dutch auction with a declining price", async function () {
    await auction.connect(alice).createAuction(
      await tldRegistry.getAddress(),
      1,
      1, // DUTCH
      ethers.parseEther("1000"),
      ethers.parseEther("100"),
      3600
    );
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine");
    const price = await auction.currentDutchPrice(1);
    expect(price).to.be.lessThan(ethers.parseEther("1000"));
    expect(price).to.be.greaterThan(ethers.parseEther("100"));

    await auction.connect(bob).buyDutch(1);
    expect(await tldRegistry.ownerOf(1)).to.equal(bob.address);
  });
});
