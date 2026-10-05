const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WhiteLabelLicense", function () {
  let usdc, license, admin, treasury, partner;

  beforeEach(async function () {
    [admin, treasury, partner] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockPlugToken");
    usdc = await MockERC20.deploy();
    await usdc.waitForDeployment();

    const WhiteLabelLicense = await ethers.getContractFactory("WhiteLabelLicense");
    license = await WhiteLabelLicense.deploy(await usdc.getAddress(), treasury.address, admin.address);
    await license.waitForDeployment();

    await usdc.connect(admin).transfer(partner.address, ethers.parseEther("1000000"));
    await usdc.connect(partner).approve(await license.getAddress(), ethers.parseEther("1000000"));
  });

  it("issues a STARTER license and collects the annual fee to treasury", async function () {
    const fee = await license.tierAnnualFee(1); // STARTER
    const treasuryBefore = await usdc.balanceOf(treasury.address);

    await license.connect(admin).issueLicense(partner.address, "Partner Co", 1, 1, 0, 0);

    const treasuryAfter = await usdc.balanceOf(treasury.address);
    expect(treasuryAfter - treasuryBefore).to.equal(fee);
    expect(await license.isLicensed(partner.address)).to.equal(true);
  });

  it("rejects issuing a second license to an already-licensed partner", async function () {
    await license.connect(admin).issueLicense(partner.address, "Partner Co", 1, 1, 0, 0);
    await expect(license.connect(admin).issueLicense(partner.address, "Partner Co", 1, 1, 0, 0)).to.be.revertedWith(
      "WLL: already licensed"
    );
  });

  it("blocks a non-sales-role address from issuing a license", async function () {
    await expect(
      license.connect(partner).issueLicense(partner.address, "Partner Co", 1, 1, 0, 0)
    ).to.be.revertedWithCustomError(license, "AccessControlUnauthorizedAccount");
  });

  it("lets a licensee renew and extend expiry", async function () {
    await license.connect(admin).issueLicense(partner.address, "Partner Co", 1, 1, 0, 0);
    const before = (await license.licenses(partner.address)).expiresAt;

    await license.connect(partner).renewLicense(1);

    const after = (await license.licenses(partner.address)).expiresAt;
    expect(after - before).to.equal(365n * 24n * 60n * 60n);
  });

  it("blocks SOVEREIGN tier from self-service renewal", async function () {
    await license.connect(admin).issueLicense(partner.address, "Partner Co", 4 /* SOVEREIGN */, 1, ethers.parseEther("1000"), 500);
    await expect(license.connect(partner).renewLicense(1)).to.be.revertedWith("WLL: contact sales");
  });

  it("lets an admin revoke a license", async function () {
    await license.connect(admin).issueLicense(partner.address, "Partner Co", 1, 1, 0, 0);
    await license.connect(admin).revokeLicense(partner.address);
    expect(await license.isLicensed(partner.address)).to.equal(false);
  });

  it("isLicensed reports false after expiry", async function () {
    await license.connect(admin).issueLicense(partner.address, "Partner Co", 1, 1, 0, 0);
    const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
    await time.increase(366 * 24 * 60 * 60);
    expect(await license.isLicensed(partner.address)).to.equal(false);
  });
});
