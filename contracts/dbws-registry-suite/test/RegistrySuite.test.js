const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DBWS Registry Suite", function () {
  let router, plug, entity, ip, note, license, community, usdc;
  let owner, treasury, alice, bob, lender;

  const T1 = 97_000_000n; // 97 USDC (6 decimals)
  const XFER1 = 25_000_000n;
  const SECRET = ethers.encodeBytes32String("shh");

  beforeEach(async () => {
    [owner, treasury, alice, bob, lender] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    router = await (await ethers.getContractFactory("RevenueRouter")).deploy(
      treasury.address,
      await usdc.getAddress(),
      owner.address
    );
    plug = await (await ethers.getContractFactory("PlugRegistry")).deploy(
      await router.getAddress(),
      await usdc.getAddress(),
      owner.address
    );
    entity = await (await ethers.getContractFactory("EntityRegistry")).deploy(
      await router.getAddress(),
      await usdc.getAddress(),
      owner.address
    );
    ip = await (await ethers.getContractFactory("IPRegistry")).deploy(
      await router.getAddress(),
      await usdc.getAddress(),
      owner.address
    );
    note = await (await ethers.getContractFactory("NoteRegistry")).deploy(owner.address);
    license = await (await ethers.getContractFactory("LicenseRegistry")).deploy(
      await router.getAddress(),
      await usdc.getAddress(),
      owner.address
    );
    community = await (await ethers.getContractFactory("CommunityRegistry")).deploy(
      await router.getAddress(),
      await usdc.getAddress(),
      owner.address
    );

    await plug.configureTLD("plug", T1, XFER1, true);

    // Fund every test wallet with USDC and pre-approve every registry (a
    // frontend would call approve() itself; simplifies the test bodies).
    for (const user of [alice, bob, lender]) {
      await usdc.mint(user.address, 10_000_000_000n); // 10,000 USDC
      for (const registry of [plug, entity, ip, license, community]) {
        await usdc.connect(user).approve(await registry.getAddress(), ethers.MaxUint256);
      }
    }
  });

  async function commitAndWait(tld, name, buyer, secret) {
    const commitment = await plug.makeCommitment(tld, name, buyer.address, secret);
    await plug.connect(buyer).commit(commitment);
    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine");
  }

  describe("RevenueRouter", () => {
    it("accrues routed USDC fees and lets owner withdraw to treasury", async () => {
      await commitAndWait("plug", "vance", alice, SECRET);
      await plug.connect(alice).registerDomain("plug", "vance", alice.address, 1, "ipfs://x", SECRET);
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(T1);
      const before = await usdc.balanceOf(treasury.address);
      await router.connect(owner).withdrawAll();
      const after = await usdc.balanceOf(treasury.address);
      expect(after - before).to.equal(T1);
    });

    it("swaps payment tokens via setPaymentToken and fees still work", async () => {
      const MockPlug = await ethers.getContractFactory("MockUSDC"); // any ERC-20 stand-in
      const mockPlugToken = await MockPlug.deploy();
      await mockPlugToken.mint(alice.address, 10_000_000_000n);
      await mockPlugToken.connect(alice).approve(await plug.getAddress(), ethers.MaxUint256);

      await plug.setPaymentToken(await mockPlugToken.getAddress());
      await commitAndWait("plug", "swapped", alice, SECRET);
      await plug.connect(alice).registerDomain("plug", "swapped", alice.address, 1, "", SECRET);

      expect(await mockPlugToken.balanceOf(await router.getAddress())).to.equal(T1);
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(0);
    });
  });

  describe("PlugRegistry", () => {
    it("registers a domain via commit-reveal and resolves it", async () => {
      await commitAndWait("plug", "vance", alice, SECRET);
      await plug.connect(alice).registerDomain("plug", "vance", alice.address, 1, "ipfs://x", SECRET);
      expect(await plug.resolve("plug", "vance")).to.equal(alice.address);
      expect(await plug.isAvailable("plug", "vance")).to.equal(false);
    });

    it("rejects registerDomain reveal without a prior commit (front-running protection)", async () => {
      await expect(
        plug.connect(alice).registerDomain("plug", "griefed", alice.address, 1, "", SECRET)
      ).to.be.revertedWithCustomError(plug, "CommitmentNotFound");
    });

    it("rejects revealing before minCommitmentAge has passed", async () => {
      const commitment = await plug.makeCommitment("plug", "vance", alice.address, SECRET);
      await plug.connect(alice).commit(commitment);
      await expect(
        plug.connect(alice).registerDomain("plug", "vance", alice.address, 1, "", SECRET)
      ).to.be.revertedWithCustomError(plug, "CommitmentTooNew");
    });

    it("rejects disabled TLDs", async () => {
      await commitAndWait("nope", "x", alice, SECRET);
      await expect(
        plug.connect(alice).registerDomain("nope", "x", alice.address, 1, "", SECRET)
      ).to.be.revertedWithCustomError(plug, "TLDDisabled");
    });

    it("blocks transfer while locked as collateral, allows after unlock", async () => {
      await commitAndWait("plug", "asset", alice, SECRET);
      await plug.connect(alice).registerDomain("plug", "asset", alice.address, 1, "", SECRET);
      const id = await plug.nameToId(await plug.key("plug", "asset"));
      await plug.connect(alice).lockForLending(id, lender.address, 42);
      await expect(
        plug.connect(alice).transferFrom(alice.address, bob.address, id)
      ).to.be.revertedWithCustomError(plug, "DomainLockedErr");
      await plug.connect(lender).unlock(id);
      await plug.connect(alice).transferFrom(alice.address, bob.address, id);
      expect(await plug.ownerOf(id)).to.equal(bob.address);
    });

    it("authorized registrar can mint without a commitment or payment", async () => {
      await plug.setAuthorizedRegistrar(bob.address, true);
      await plug.connect(bob).registerDomainFor("plug", "paid", alice.address, 2, "");
      expect(await plug.resolve("plug", "paid")).to.equal(alice.address);
    });
  });

  describe("EntityRegistry", () => {
    it("registers an entity in USDC and links a domain", async () => {
      await entity.connect(alice).registerEntity("Wallcrest Capital LLC", "LLC", "OH", "0xhash", 1600000000, "ipfs://e");
      const ids = await entity.getOwnerEntities(alice.address);
      expect(ids.length).to.equal(1);
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(97_000_000n);
      await entity.connect(alice).linkDomain(ids[0], "wallcrest.plug");
      expect((await entity.getLinkedDomains(ids[0]))[0]).to.equal("wallcrest.plug");
    });
  });

  describe("IPRegistry", () => {
    it("registers IP in USDC and blocks duplicate content hashes", async () => {
      const h = ethers.keccak256(ethers.toUtf8Bytes("my-song"));
      await ip.connect(alice).registerIP("Track One", 7, "ipfs://d", h, 1600000000, "ipfs://m");
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(47_000_000n);
      await expect(
        ip.connect(bob).registerIP("Copy", 7, "ipfs://d", h, 1600000000, "ipfs://m")
      ).to.be.revertedWithCustomError(ip, "ContentRegistered");
    });

    it("creates a license from the owner", async () => {
      const h = ethers.keccak256(ethers.toUtf8Bytes("brand"));
      await ip.connect(alice).registerIP("Brand", 2, "ipfs://d", h, 1600000000, "ipfs://m");
      await ip.connect(alice).createLicense(1, bob.address, "Non-Exclusive", 0, 500);
      expect(await ip.licenseCount(1)).to.equal(1);
    });
  });

  describe("NoteRegistry", () => {
    it("originates, records payment, and reports portfolio health", async () => {
      await note.originateNote(alice.address, 0, 1000n * 10n ** 6n, 1200, 90, 5, 1, 6000);
      await note.recordPayment(1, 1000n * 10n ** 6n, 1000n * 10n ** 6n, 0);
      const [totalValue, originated, defaulted, repaid] = await note.getPortfolioHealth();
      expect(originated).to.equal(1);
      expect(repaid).to.equal(1);
      expect(totalValue).to.equal(0);
    });
  });

  describe("LicenseRegistry", () => {
    it("registers a cannabis license in USDC and prevents duplicate numbers", async () => {
      await license.connect(alice).registerLicense("OH-DISP-001", "OH", 1, "Green Co", "123 St", 1600000000, 9999999999, "ipfs://l");
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(197_000_000n);
      await expect(
        license.connect(bob).registerLicense("OH-DISP-001", "OH", 1, "Dup", "x", 1, 2, "")
      ).to.be.revertedWithCustomError(license, "AlreadyRegistered");
    });
  });

  describe("CommunityRegistry", () => {
    it("joins free tier and blocks double registration", async () => {
      await community.connect(alice).joinCommunity("Vic", 0, "ipfs://c");
      expect(await community.walletToTokenId(alice.address)).to.equal(1);
      await expect(
        community.connect(alice).joinCommunity("Vic2", 0, "")
      ).to.be.revertedWithCustomError(community, "AlreadyRegistered");
    });

    it("founding member token is soulbound and costs the tier fee in USDC", async () => {
      await community.connect(alice).joinCommunity("Founder", 3, "ipfs://f");
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(1_997_000_000n);
      const id = await community.walletToTokenId(alice.address);
      await expect(
        community.connect(alice).transferFrom(alice.address, bob.address, id)
      ).to.be.revertedWithCustomError(community, "Soulbound");
    });

    it("The Orders tier grants voting power; owner can initiate order", async () => {
      await community.connect(alice).joinCommunity("Member", 2, "ipfs://o");
      expect(await community.votingPowerOf(alice.address)).to.equal(1);
      const id = await community.walletToTokenId(alice.address);
      await community.connect(owner).initiateIntoOrder(id, 1);
      const m = await community.members(id);
      expect(m.order).to.equal(1n);
    });

    it("upgradeTier charges only the USDC difference between tiers", async () => {
      await community.connect(alice).joinCommunity("Member", 1, "ipfs://o"); // PLUG_MEMBER, 97 USDC
      const before = await usdc.balanceOf(await router.getAddress());
      await community.connect(alice).upgradeTier(2); // THE_ORDERS, 497 USDC
      const after = await usdc.balanceOf(await router.getAddress());
      expect(after - before).to.equal(400_000_000n); // 497 - 97
    });
  });
});
