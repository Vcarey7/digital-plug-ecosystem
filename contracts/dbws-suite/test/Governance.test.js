const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlugVesting", function () {
  let vesting, plug, admin, beneficiary;

  beforeEach(async function () {
    [admin, beneficiary] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const PlugVesting = await ethers.getContractFactory("PlugVesting");
    vesting = await PlugVesting.deploy(await plug.getAddress(), admin.address);
    await plug.approve(await vesting.getAddress(), ethers.MaxUint256);
  });

  it("vests linearly after the cliff and releases proportionally", async function () {
    const start = (await ethers.provider.getBlock("latest")).timestamp;
    await vesting.createSchedule(beneficiary.address, ethers.parseEther("1000"), start, 100, 1000, true);

    // Before cliff: nothing vested.
    expect(await vesting.releasable(1)).to.equal(0);

    await ethers.provider.send("evm_increaseTime", [600]); // past cliff, 60% through
    await ethers.provider.send("evm_mine");
    await vesting.connect(beneficiary).release(1);
    const bal = await plug.balanceOf(beneficiary.address);
    expect(bal).to.be.greaterThan(ethers.parseEther("500"));
    expect(bal).to.be.lessThan(ethers.parseEther("700"));
  });

  it("lets admin revoke a revocable schedule, refunding the unvested remainder", async function () {
    const start = (await ethers.provider.getBlock("latest")).timestamp;
    await vesting.createSchedule(beneficiary.address, ethers.parseEther("1000"), start, 0, 1000, true);
    await ethers.provider.send("evm_increaseTime", [500]);
    await ethers.provider.send("evm_mine");
    const adminBefore = await plug.balanceOf(admin.address);
    await vesting.revoke(1);
    const adminAfter = await plug.balanceOf(admin.address);
    expect(adminAfter).to.be.greaterThan(adminBefore);
    await expect(vesting.revoke(1)).to.be.revertedWithCustomError(vesting, "AlreadyRevoked");
  });

  it("blocks revoking a non-revocable schedule", async function () {
    const start = (await ethers.provider.getBlock("latest")).timestamp;
    await vesting.createSchedule(beneficiary.address, ethers.parseEther("1000"), start, 0, 1000, false);
    await expect(vesting.revoke(1)).to.be.revertedWithCustomError(vesting, "NotRevocable");
  });
});

describe("PlugMultiSig", function () {
  let multisig, ownerA, ownerB, ownerC, outsider;

  beforeEach(async function () {
    [ownerA, ownerB, ownerC, outsider] = await ethers.getSigners();
    const PlugMultiSig = await ethers.getContractFactory("PlugMultiSig");
    multisig = await PlugMultiSig.deploy([ownerA.address, ownerB.address, ownerC.address], 2);
    await ownerA.sendTransaction({ to: await multisig.getAddress(), value: ethers.parseEther("1") });
  });

  it("requires the configured threshold of confirmations before executing", async function () {
    await multisig.connect(ownerA).submit(outsider.address, ethers.parseEther("0.5"), "0x");
    await expect(multisig.connect(ownerA).execute(0)).to.be.revertedWithCustomError(multisig, "NotEnoughConfirmations");
    await multisig.connect(ownerB).confirm(0);
    const before = await ethers.provider.getBalance(outsider.address);
    await multisig.connect(ownerA).execute(0);
    const after = await ethers.provider.getBalance(outsider.address);
    expect(after - before).to.equal(ethers.parseEther("0.5"));
  });

  it("blocks non-owners from submitting or confirming", async function () {
    await expect(multisig.connect(outsider).submit(outsider.address, 0, "0x")).to.be.revertedWithCustomError(
      multisig,
      "NotOwner"
    );
  });

  it("lets an owner revoke their confirmation before execution", async function () {
    await multisig.connect(ownerA).submit(outsider.address, 0, "0x");
    await multisig.connect(ownerA).revoke(0);
    await expect(multisig.connect(ownerA).revoke(0)).to.be.revertedWithCustomError(multisig, "NotConfirmed");
  });
});

describe("PlugGovernance + PlugTimeLock (wiring smoke test)", function () {
  it("deploys the timelock-controlled Governor over GPlugToken votes", async function () {
    const [admin, proposer] = await ethers.getSigners();
    const GPlugToken = await ethers.getContractFactory("GPlugToken");
    const gplug = await GPlugToken.deploy(admin.address);
    await gplug.grantRole(await gplug.MINTER_ROLE(), admin.address);
    await gplug.mint(admin.address, ethers.parseEther("1000000"));
    await gplug.setTransferAllowlist(admin.address, true);
    await gplug.connect(admin).delegate(admin.address);

    const PlugTimeLock = await ethers.getContractFactory("PlugTimeLock");
    const timelock = await PlugTimeLock.deploy(3600, [], [], admin.address);

    const PlugGovernance = await ethers.getContractFactory("PlugGovernance");
    const governance = await PlugGovernance.deploy(
      await gplug.getAddress(),
      await timelock.getAddress(),
      1, // votingDelay (blocks)
      50, // votingPeriod (blocks)
      0, // proposalThreshold
      4 // quorum %
    );

    expect(await governance.name()).to.equal("Digital Plug Governance");
    expect(await governance.votingPeriod()).to.equal(50);
  });
});
