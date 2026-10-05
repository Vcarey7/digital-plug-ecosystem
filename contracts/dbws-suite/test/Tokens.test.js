const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlugToken", function () {
  let plug, admin, treasury, alice;

  beforeEach(async function () {
    [admin, treasury, alice] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(treasury.address, admin.address);
  });

  it("mints the initial supply to treasury", async function () {
    expect(await plug.balanceOf(treasury.address)).to.equal(ethers.parseEther("250000000"));
  });

  it("lets MINTER_ROLE mint up to the cap and rejects going over", async function () {
    await plug.mint(alice.address, ethers.parseEther("1000"));
    expect(await plug.balanceOf(alice.address)).to.equal(ethers.parseEther("1000"));
    await expect(plug.mint(alice.address, ethers.parseEther("1000000000"))).to.be.revertedWithCustomError(
      plug,
      "SupplyCapExceeded"
    );
  });

  it("blocks non-minters from minting", async function () {
    await expect(plug.connect(alice).mint(alice.address, 1)).to.be.reverted;
  });

  it("pauses transfers but still allows mint/burn", async function () {
    await plug.connect(treasury).transfer(alice.address, ethers.parseEther("10"));
    await plug.setPaused(true);
    await expect(plug.connect(alice).transfer(treasury.address, 1)).to.be.revertedWithCustomError(
      plug,
      "TransfersPaused"
    );
    await plug.mint(alice.address, ethers.parseEther("1")); // mint still works
  });
});

describe("GPlugToken", function () {
  let gplug, admin, alice, bob, converter;

  beforeEach(async function () {
    [admin, alice, bob, converter] = await ethers.getSigners();
    const GPlugToken = await ethers.getContractFactory("GPlugToken");
    gplug = await GPlugToken.deploy(admin.address);
    await gplug.grantRole(await gplug.MINTER_ROLE(), admin.address);
  });

  it("blocks wallet-to-wallet transfers unless allowlisted", async function () {
    await gplug.mint(alice.address, 100);
    await expect(gplug.connect(alice).transfer(bob.address, 10)).to.be.revertedWithCustomError(
      gplug,
      "TransferRestricted"
    );
  });

  it("allows transfers once one side is allowlisted (e.g. the converter)", async function () {
    await gplug.mint(converter.address, 100);
    await gplug.setTransferAllowlist(converter.address, true);
    await gplug.connect(converter).transfer(alice.address, 10);
    expect(await gplug.balanceOf(alice.address)).to.equal(10);
  });
});

describe("GPlugConverter", function () {
  let plug, gplug, converter, admin, alice;

  beforeEach(async function () {
    [admin, alice] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);

    const GPlugToken = await ethers.getContractFactory("GPlugToken");
    gplug = await GPlugToken.deploy(admin.address);

    const GPlugConverter = await ethers.getContractFactory("GPlugConverter");
    converter = await GPlugConverter.deploy(await plug.getAddress(), await gplug.getAddress(), admin.address);

    await gplug.grantRole(await gplug.MINTER_ROLE(), await converter.getAddress());
    await gplug.setTransferAllowlist(await converter.getAddress(), true);

    await plug.transfer(alice.address, ethers.parseEther("1000"));
    await plug.connect(alice).approve(await converter.getAddress(), ethers.MaxUint256);
  });

  it("locks PLUG and mints a multiplied amount of GPLUG", async function () {
    await converter.connect(alice).lock(ethers.parseEther("100"), 3); // D365, 2.5x
    expect(await gplug.balanceOf(alice.address)).to.equal(ethers.parseEther("250"));
  });

  it("blocks unlocking before the term ends and returns principal after", async function () {
    await converter.connect(alice).lock(ethers.parseEther("100"), 0); // D30
    await expect(converter.connect(alice).unlock(0)).to.be.revertedWithCustomError(converter, "StillLocked");
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");
    const before = await plug.balanceOf(alice.address);
    await converter.connect(alice).unlock(0);
    expect(await plug.balanceOf(alice.address)).to.equal(before + ethers.parseEther("100"));
    expect(await gplug.balanceOf(alice.address)).to.equal(0);
  });
});

describe("MicroFundToken", function () {
  let mft, admin, fundVault, alice;

  beforeEach(async function () {
    [admin, fundVault, alice] = await ethers.getSigners();
    const MicroFundToken = await ethers.getContractFactory("MicroFundToken");
    mft = await MicroFundToken.deploy(admin.address);
    await mft.grantRole(await mft.FUND_ROLE(), fundVault.address);
  });

  it("mints/burns only via FUND_ROLE and tracks reported backing", async function () {
    await expect(mft.connect(alice).fundMint(alice.address, 100)).to.be.reverted;
    await mft.connect(fundVault).fundMint(alice.address, 100);
    expect(await mft.balanceOf(alice.address)).to.equal(100);

    await mft.connect(fundVault).reportBacking(100_000_000n);
    expect(await mft.reportedBacking()).to.equal(100_000_000n);

    await mft.connect(fundVault).fundBurn(alice.address, 40);
    expect(await mft.balanceOf(alice.address)).to.equal(60);
  });
});
