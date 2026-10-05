const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlugFactory", function () {
  let plug, tldRegistry, factory, admin, treasury, tldOwner, registrant;

  beforeEach(async function () {
    [admin, treasury, tldOwner, registrant] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);

    const UserTLDRegistry = await ethers.getContractFactory("UserTLDRegistry");
    tldRegistry = await UserTLDRegistry.deploy(await plug.getAddress(), treasury.address, admin.address);

    const PlugFactory = await ethers.getContractFactory("PlugFactory");
    factory = await PlugFactory.deploy(
      await plug.getAddress(),
      await tldRegistry.getAddress(),
      treasury.address,
      admin.address
    );

    await tldRegistry.grantRole(await tldRegistry.ROYALTY_REPORTER_ROLE(), await factory.getAddress());

    await plug.transfer(tldOwner.address, ethers.parseEther("1000000"));
    await plug.connect(tldOwner).approve(await tldRegistry.getAddress(), ethers.MaxUint256);
    await tldRegistry.connect(tldOwner).mintTLD("hustle", 1_000); // 10% royalty

    await plug.transfer(registrant.address, ethers.parseEther("1000"));
    await plug.connect(registrant).approve(await factory.getAddress(), ethers.MaxUint256);
  });

  it("routes a royalty share to the TLD owner and the rest to treasury", async function () {
    const treasuryBefore = await plug.balanceOf(treasury.address);
    await factory.connect(registrant).registerSubdomain("vance", "hustle", ethers.parseEther("100"));

    expect(await factory.subdomainOwner(ethers.keccak256(ethers.toUtf8Bytes("vance.hustle")))).to.equal(
      registrant.address
    );
    expect(await tldRegistry.pendingRoyalties(1)).to.equal(ethers.parseEther("10"));
    expect(await plug.balanceOf(treasury.address)).to.equal(treasuryBefore + ethers.parseEther("90"));
  });

  it("blocks registering an already-taken subdomain", async function () {
    await factory.connect(registrant).registerSubdomain("vance", "hustle", ethers.parseEther("100"));
    await expect(
      factory.connect(registrant).registerSubdomain("vance", "hustle", ethers.parseEther("100"))
    ).to.be.revertedWithCustomError(factory, "SubdomainTaken");
  });
});

describe("TLDRoyalty", function () {
  let royalty, admin, receiver;

  beforeEach(async function () {
    [admin, receiver] = await ethers.getSigners();
    const TLDRoyalty = await ethers.getContractFactory("TLDRoyalty");
    royalty = await TLDRoyalty.deploy(admin.address);
  });

  it("returns the default rate until a per-TLD override is set", async function () {
    let [, amount] = await royalty.royaltyInfo(1, ethers.parseEther("100"));
    expect(amount).to.equal(ethers.parseEther("5")); // 5% default

    await royalty.setRoyalty(1, receiver.address, 1_000); // 10%
    let [recv, amt2] = await royalty.royaltyInfo(1, ethers.parseEther("100"));
    expect(recv).to.equal(receiver.address);
    expect(amt2).to.equal(ethers.parseEther("10"));
  });

  it("rejects a royalty above the 20% cap", async function () {
    await expect(royalty.setRoyalty(1, receiver.address, 2_001)).to.be.revertedWith("MAX 20%");
  });
});
