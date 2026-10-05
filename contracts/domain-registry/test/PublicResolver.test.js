const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("PublicResolver", function () {
  let registry, resolver, owner, tldRegistrar, alice, bob, resolverAddr;
  const YEAR = 365 * 24 * 60 * 60;
  const SECRET = ethers.encodeBytes32String("shh");

  beforeEach(async function () {
    [owner, tldRegistrar, alice, bob, resolverAddr] = await ethers.getSigners();
    const DomainRegistry = await ethers.getContractFactory("DomainRegistry");
    registry = await DomainRegistry.deploy("Digital Plug Domains", "DPD", tldRegistrar.address);
    await registry.waitForDeployment();

    const PublicResolver = await ethers.getContractFactory("PublicResolver");
    resolver = await PublicResolver.deploy(await registry.getAddress());
    await resolver.waitForDeployment();

    await registry.connect(tldRegistrar).registerTLD("plug", owner.address, resolverAddr.address, "ipfs://plug");
    const commitment = await registry.makeDomainCommitment("plug", "alice", alice.address, SECRET);
    await registry.connect(alice).commit(commitment);
    await time.increase(61);
    const cost = await registry.baseDomainPrice();
    await registry
      .connect(alice)
      .registerDomain("plug", "alice", YEAR, await resolver.getAddress(), "ipfs://alice", SECRET, { value: cost });
  });

  function domainHash() {
    return registry.namehash("alice.plug");
  }

  it("lets the domain owner set and read an address record", async function () {
    const hash = await domainHash();
    await resolver.connect(alice).setAddress(hash, bob.address);
    expect(await resolver.addr(hash)).to.equal(bob.address);
  });

  it("rejects address updates from a non-owner", async function () {
    const hash = await domainHash();
    await expect(resolver.connect(bob).setAddress(hash, bob.address)).to.be.revertedWith(
      "Only domain owner can update records"
    );
  });

  it("sets and reads a text record", async function () {
    const hash = await domainHash();
    await resolver.connect(alice).setText(hash, "email", "alice@digitalplug.co");
    expect(await resolver.text(hash, "email")).to.equal("alice@digitalplug.co");
  });

  it("sets and reads an IPFS content hash", async function () {
    const hash = await domainHash();
    await resolver.connect(alice).setContentHash(hash, "ipfs://QmExample");
    expect(await resolver.contentHash(hash)).to.equal("ipfs://QmExample");
  });

  it("rejects record updates for a non-existent domain", async function () {
    const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("nope.plug"));
    await expect(resolver.connect(alice).setAddress(fakeHash, bob.address)).to.be.revertedWith(
      "Domain does not exist"
    );
  });
});
