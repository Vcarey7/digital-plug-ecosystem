const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RefugeHousing", function () {
  let housing, usdc, admin, grantTreasury, resident;

  beforeEach(async function () {
    [admin, grantTreasury, resident] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const RefugeHousing = await ethers.getContractFactory("RefugeHousing");
    housing = await RefugeHousing.deploy(await usdc.getAddress(), grantTreasury.address, admin.address);

    await usdc.transfer(resident.address, 1_000_000n);
    await usdc.connect(resident).approve(await housing.getAddress(), ethers.MaxUint256);
    await usdc.transfer(grantTreasury.address, 1_000_000_000n);
    await usdc.connect(grantTreasury).approve(await housing.getAddress(), ethers.MaxUint256);
  });

  it("accrues rent credits and pays a graduation grant from the grant treasury", async function () {
    await housing.enroll(resident.address, 0);
    await housing.connect(resident).payRent(50_000n);
    expect((await housing.residents(resident.address)).rentCredits).to.equal(50e6);

    const before = await usdc.balanceOf(resident.address);
    await housing.graduate(resident.address);
    expect(await usdc.balanceOf(resident.address)).to.equal(before + 50_000_000n);
  });
});

describe("ScoreRegistry", function () {
  let registry, admin, alice;

  beforeEach(async function () {
    [admin, alice] = await ethers.getSigners();
    const ScoreRegistry = await ethers.getContractFactory("ScoreRegistry");
    registry = await ScoreRegistry.deploy(admin.address);
  });

  it("computes a weighted composite score across categories", async function () {
    const credit = ethers.encodeBytes32String("credit");
    const engagement = ethers.encodeBytes32String("engagement");
    await registry.setCategoryWeight(credit, 6_000);
    await registry.setCategoryWeight(engagement, 4_000);
    await registry.setScore(alice.address, credit, 800);
    await registry.setScore(alice.address, engagement, 500);
    // 800*0.6 + 500*0.4 = 480+200 = 680
    expect(await registry.compositeScore(alice.address)).to.equal(680);
  });
});

describe("AIAgentGateway", function () {
  let gateway, plug, admin, treasury, agent, user;

  beforeEach(async function () {
    [admin, treasury, agent, user] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const AIAgentGateway = await ethers.getContractFactory("AIAgentGateway");
    gateway = await AIAgentGateway.deploy(await plug.getAddress(), treasury.address, admin.address);
    await gateway.grantRole(await gateway.AGENT_ROLE(), agent.address);
    await plug.transfer(user.address, ethers.parseEther("100"));
    await plug.connect(user).approve(await gateway.getAddress(), ethers.MaxUint256);
  });

  it("tops up credits from PLUG and lets an agent meter usage", async function () {
    await gateway.connect(user).topUp(ethers.parseEther("10")); // 0.01 PLUG/credit -> 1000 credits
    expect(await gateway.credits(user.address)).to.equal(1000n);
    await gateway.connect(agent).consume(user.address, 100, "chat-completion");
    expect(await gateway.credits(user.address)).to.equal(900n);
  });

  it("blocks consuming more credits than the user has", async function () {
    await gateway.connect(user).topUp(ethers.parseEther("1"));
    await expect(gateway.connect(agent).consume(user.address, 999999, "x")).to.be.revertedWithCustomError(
      gateway,
      "InsufficientCredits"
    );
  });
});

describe("PlugMarketplace", function () {
  let market, plug, tldRegistry, admin, treasury, seller, buyer;

  beforeEach(async function () {
    [admin, treasury, seller, buyer] = await ethers.getSigners();
    const PlugToken = await ethers.getContractFactory("PlugToken");
    plug = await PlugToken.deploy(admin.address, admin.address);
    const UserTLDRegistry = await ethers.getContractFactory("UserTLDRegistry");
    tldRegistry = await UserTLDRegistry.deploy(await plug.getAddress(), treasury.address, admin.address);
    const PlugMarketplace = await ethers.getContractFactory("PlugMarketplace");
    market = await PlugMarketplace.deploy(await plug.getAddress(), treasury.address, admin.address);

    await plug.transfer(seller.address, ethers.parseEther("100000"));
    await plug.transfer(buyer.address, ethers.parseEther("100000"));
    await plug.connect(seller).approve(await tldRegistry.getAddress(), ethers.MaxUint256);
    await plug.connect(buyer).approve(await market.getAddress(), ethers.MaxUint256);
    await tldRegistry.connect(seller).mintTLD("hustle", 0);
    await tldRegistry.connect(seller).setApprovalForAll(await market.getAddress(), true);
  });

  it("lists and sells an NFT with the protocol fee routed to treasury", async function () {
    const treasuryBefore = await plug.balanceOf(treasury.address);
    await market.connect(seller).list(await tldRegistry.getAddress(), 1, ethers.parseEther("100"));
    await market.connect(buyer).buy(1);
    expect(await tldRegistry.ownerOf(1)).to.equal(buyer.address);
    expect(await plug.balanceOf(treasury.address)).to.equal(
      treasuryBefore + (ethers.parseEther("100") * 250n) / 10_000n
    );
  });

  it("lets the seller delist and reclaim the NFT", async function () {
    await market.connect(seller).list(await tldRegistry.getAddress(), 1, ethers.parseEther("100"));
    await market.connect(seller).delist(1);
    expect(await tldRegistry.ownerOf(1)).to.equal(seller.address);
  });
});

describe("MintingFactory", function () {
  let factory, usdc, admin, treasury, creator, minter;

  beforeEach(async function () {
    [admin, treasury, creator, minter] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const MintingFactory = await ethers.getContractFactory("MintingFactory");
    factory = await MintingFactory.deploy(treasury.address, admin.address);
    await factory.grantRole(await factory.CREATOR_ROLE(), creator.address);
    await usdc.transfer(minter.address, 1_000_000n);
    await usdc.connect(minter).approve(await factory.getAddress(), ethers.MaxUint256);
  });

  it("mints against supply and splits proceeds between creator and treasury", async function () {
    await factory.connect(creator).createCampaign(await usdc.getAddress(), 10_000n, 100, ethers.encodeBytes32String("h"));
    await factory.connect(minter).mint(1, 2);
    expect(await usdc.balanceOf(treasury.address)).to.equal(1_000n); // 5% of 20,000
    expect(await usdc.balanceOf(creator.address)).to.equal(19_000n);
  });

  it("blocks minting past max supply", async function () {
    await factory.connect(creator).createCampaign(await usdc.getAddress(), 10_000n, 1, ethers.encodeBytes32String("h"));
    await expect(factory.connect(minter).mint(1, 2)).to.be.revertedWithCustomError(factory, "SoldOut");
  });
});

describe("PlugPayments", function () {
  let payments, usdc, admin, treasury, resolver, payer, recipient;

  beforeEach(async function () {
    [admin, treasury, payer, recipient] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // A minimal resolver stand-in: PlugRegistry itself implements resolve()-shaped
    // lookups via PlugResolver, but for this unit test we deploy PlugResolver.
    const PlugRegistry = await ethers.getContractFactory("PlugRegistry");
    const registry = await PlugRegistry.deploy(admin.address);
    await registry.grantRole(await registry.REGISTRAR_ROLE(), admin.address);
    await registry.register(recipient.address, "vance", "plug", 365 * 24 * 60 * 60);

    const PlugResolver = await ethers.getContractFactory("PlugResolver");
    resolver = await PlugResolver.deploy(await registry.getAddress());
    await resolver.connect(recipient).setAddress(1, recipient.address);

    const PlugPayments = await ethers.getContractFactory("PlugPayments");
    payments = await PlugPayments.deploy(await resolver.getAddress(), treasury.address, admin.address);

    await usdc.transfer(payer.address, 1_000_000n);
    await usdc.connect(payer).approve(await payments.getAddress(), ethers.MaxUint256);
  });

  it("resolves a domain and routes payment minus the protocol fee", async function () {
    await payments.connect(payer).payDomain("vance", "plug", await usdc.getAddress(), 100_000n);
    expect(await usdc.balanceOf(treasury.address)).to.equal(500n); // 0.5%
    expect(await usdc.balanceOf(recipient.address)).to.equal(99_500n);
  });
});

describe("FamilyCredit", function () {
  let credit, usdc, admin, head, member;

  beforeEach(async function () {
    [admin, head, member] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    const FamilyCredit = await ethers.getContractFactory("FamilyCredit");
    credit = await FamilyCredit.deploy(await usdc.getAddress(), ethers.ZeroAddress, admin.address);
    await credit.grantRole(await credit.MANAGER_ROLE(), head.address);

    await usdc.approve(await credit.getAddress(), ethers.MaxUint256);
    await credit.fundReserve(1_000_000n);
  });

  it("lets an added member draw and repay against the family limit at 0% interest", async function () {
    await credit.connect(head).openLine(100_000n);
    await credit.connect(head).addMember(1, member.address);
    await credit.connect(member).draw(1, 50_000n);
    expect(await usdc.balanceOf(member.address)).to.equal(50_000n);

    await usdc.transfer(member.address, 50_000n);
    await usdc.connect(member).approve(await credit.getAddress(), ethers.MaxUint256);
    await credit.connect(member).repay(1, 50_000n);
    expect((await credit.lines(1)).drawn).to.equal(0);
  });

  it("blocks drawing past the line limit", async function () {
    await credit.connect(head).openLine(10_000n);
    await expect(credit.connect(head).draw(1, 20_000n)).to.be.revertedWithCustomError(credit, "OverLimit");
  });
});

describe("TokenBoundAccount", function () {
  it("lets only the current NFT owner execute calls through the account", async function () {
    const [admin, owner, outsider] = await ethers.getSigners();
    const PlugRegistry = await ethers.getContractFactory("PlugRegistry");
    const registry = await PlugRegistry.deploy(admin.address);
    await registry.grantRole(await registry.REGISTRAR_ROLE(), admin.address);
    await registry.register(owner.address, "vance", "plug", 365 * 24 * 60 * 60);

    const TokenBoundAccount = await ethers.getContractFactory("TokenBoundAccount");
    const tba = await TokenBoundAccount.deploy(await registry.getAddress(), 1);
    await owner.sendTransaction({ to: await tba.getAddress(), value: ethers.parseEther("1") });

    await expect(tba.connect(outsider).execute(outsider.address, ethers.parseEther("0.1"), "0x")).to.be.revertedWithCustomError(
      tba,
      "NotTokenOwner"
    );
    await tba.connect(owner).execute(outsider.address, ethers.parseEther("0.1"), "0x");
  });
});
