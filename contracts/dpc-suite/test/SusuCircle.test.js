const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("SusuFactory + SusuCircle", function () {
  let plug, factory, admin, alice, bob, carol;
  const CONTRIBUTION = ethers.parseEther("100");
  const PERIOD = 7 * 24 * 60 * 60;

  beforeEach(async function () {
    [admin, alice, bob, carol] = await ethers.getSigners();

    const MockPlugToken = await ethers.getContractFactory("MockPlugToken");
    plug = await MockPlugToken.deploy();
    await plug.waitForDeployment();

    const SusuFactory = await ethers.getContractFactory("SusuFactory");
    factory = await SusuFactory.deploy(await plug.getAddress(), admin.address);
    await factory.waitForDeployment();

    for (const user of [alice, bob, carol]) {
      await plug.connect(admin).transfer(user.address, ethers.parseEther("10000"));
    }
  });

  async function createCircle(organizer) {
    await plug.connect(organizer).approve(await factory.getAddress(), ethers.parseEther("10"));
    const tx = await factory
      .connect(organizer)
      .createCircle(await plug.getAddress(), CONTRIBUTION, PERIOD, 3, 0 /* FIXED_ROTATION */, "Test Circle");
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "CircleDeployed");
    return ethers.getContractAt("SusuCircle", event.args.circle);
  }

  it("charges the creation fee and deploys a circle", async function () {
    const feeRecipientBalanceBefore = await plug.balanceOf(admin.address);
    const circle = await createCircle(alice);
    expect(await factory.isValidCircle(await circle.getAddress())).to.equal(true);
    const feeRecipientBalanceAfter = await plug.balanceOf(admin.address);
    expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(ethers.parseEther("10"));
  });

  it("runs a full 3-member fixed-rotation circle to completion", async function () {
    const circle = await createCircle(alice);
    const circleAddr = await circle.getAddress();

    for (const user of [alice, bob, carol]) {
      await plug.connect(user).approve(circleAddr, ethers.parseEther("1000"));
      await circle.connect(user).joinCircle();
    }

    expect(await circle.state()).to.equal(1); // ACTIVE

    // Period 1: everyone contributes, first in rotation (alice) gets paid
    for (const user of [alice, bob, carol]) {
      await circle.connect(user).contribute();
    }
    expect((await circle.getMember(alice.address)).hasReceivedPayout).to.equal(true);

    // Period 2 -- each period's contribution window opens periodDuration
    // after circle start, so time must advance between rounds.
    await time.increase(PERIOD);
    for (const user of [alice, bob, carol]) {
      await circle.connect(user).contribute();
    }
    expect((await circle.getMember(bob.address)).hasReceivedPayout).to.equal(true);

    // Period 3 -- circle completes, bonds refunded
    await time.increase(PERIOD);
    const carolBalanceBefore = await plug.balanceOf(carol.address);
    for (const user of [alice, bob, carol]) {
      await circle.connect(user).contribute();
    }
    expect(await circle.state()).to.equal(2); // COMPLETE
    const carolBalanceAfter = await plug.balanceOf(carol.address);
    // Carol received her payout (minus 1% fee) plus her bond refund
    expect(carolBalanceAfter).to.be.greaterThan(carolBalanceBefore);
  });

  it("auto-starts the circle on the last join, blocking further joins", async function () {
    const circle = await createCircle(alice);
    const circleAddr = await circle.getAddress();
    for (const user of [alice, bob, carol]) {
      await plug.connect(user).approve(circleAddr, ethers.parseEther("1000"));
      await circle.connect(user).joinCircle();
    }
    expect(await circle.state()).to.equal(1); // ACTIVE -- auto-started once full

    const [, , , dave] = await ethers.getSigners();
    await plug.connect(admin).transfer(dave.address, ethers.parseEther("1000"));
    await plug.connect(dave).approve(circleAddr, ethers.parseEther("1000"));
    // The circle is no longer FORMING by the time it's full, so a late
    // joiner sees CircleNotForming rather than CircleFull.
    await expect(circle.connect(dave).joinCircle()).to.be.revertedWithCustomError(circle, "CircleNotForming");
  });

  it("rejects circles with fewer than 3 or more than 20 members", async function () {
    await plug.connect(alice).approve(await factory.getAddress(), ethers.parseEther("10"));
    await expect(
      factory.connect(alice).createCircle(await plug.getAddress(), CONTRIBUTION, PERIOD, 2, 0, "Too small")
    ).to.be.revertedWith("Members: 3-20");
  });
});
