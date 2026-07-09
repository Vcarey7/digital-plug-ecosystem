const hre = require("hardhat");

// TLDs registered at deploy time. Pricing here is what PlugRegistrar (USDC/
// $PLUG payments) charges; DomainRegistry's own baseDomainPrice/
// baseSubdomainPrice (native currency) apply if someone registers directly.
const TLDS = [".plug", ".dbws"];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Network:", hre.network.name);

  const usdcAddress = process.env.USDC_ADDRESS;
  const plugTokenAddress = process.env.PLUG_TOKEN_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

  console.log("\n=== Deploying DomainRegistry ===");
  const DomainRegistry = await hre.ethers.getContractFactory("DomainRegistry");
  const registry = await DomainRegistry.deploy("Digital Plug Domains", "DPD", deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("DomainRegistry deployed to:", registryAddress);

  console.log("\n=== Deploying PublicResolver ===");
  const PublicResolver = await hre.ethers.getContractFactory("PublicResolver");
  const resolver = await PublicResolver.deploy(registryAddress);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("PublicResolver deployed to:", resolverAddress);

  console.log("\n=== Deploying BatchMinting ===");
  const BatchMinting = await hre.ethers.getContractFactory("BatchMinting");
  const batchMinting = await BatchMinting.deploy(registryAddress);
  await batchMinting.waitForDeployment();
  const batchMintingAddress = await batchMinting.getAddress();
  console.log("BatchMinting deployed to:", batchMintingAddress);

  await registry.connect(deployer).setAuthorizedRegistrar(batchMintingAddress, true);
  console.log("Authorized BatchMinting as a registrar");

  let plugRegistrarAddress = null;
  if (usdcAddress && plugTokenAddress) {
    console.log("\n=== Deploying PlugRegistrar (USDC/$PLUG payment layer) ===");
    const PlugRegistrar = await hre.ethers.getContractFactory("PlugRegistrar");
    const plugRegistrar = await PlugRegistrar.deploy(
      registryAddress,
      usdcAddress,
      plugTokenAddress,
      treasuryAddress,
      resolverAddress,
      deployer.address
    );
    await plugRegistrar.waitForDeployment();
    plugRegistrarAddress = await plugRegistrar.getAddress();
    console.log("PlugRegistrar deployed to:", plugRegistrarAddress);

    await registry.connect(deployer).setAuthorizedRegistrar(plugRegistrarAddress, true);
    console.log("Authorized PlugRegistrar as a registrar");
  } else {
    console.log(
      "\nSkipping PlugRegistrar deployment (set USDC_ADDRESS and PLUG_TOKEN_ADDRESS in .env to enable USDC/$PLUG payments)"
    );
  }

  console.log("\n=== Registering TLDs ===");
  for (const tldWithDot of TLDS) {
    const tld = tldWithDot.slice(1); // registry stores TLDs without the leading dot
    const tx = await registry.connect(deployer).registerTLD(tld, deployer.address, resolverAddress, `ipfs://tld/${tld}`);
    await tx.wait();
    console.log(`Registered TLD: ${tldWithDot}`);
  }

  console.log("\n=== Deployment summary ===");
  console.log(
    JSON.stringify(
      {
        network: hre.network.name,
        DomainRegistry: registryAddress,
        PublicResolver: resolverAddress,
        BatchMinting: batchMintingAddress,
        PlugRegistrar: plugRegistrarAddress,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
