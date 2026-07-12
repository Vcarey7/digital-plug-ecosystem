require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY, POLYGON_RPC_URL, POLYGON_AMOY_RPC_URL, POLYGONSCAN_API_KEY } = process.env;

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    // Contracts pragma ^0.8.20; pinned to 0.8.24 here since that's what the
    // installed OpenZeppelin v5 contracts require.
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    // Mumbai testnet was deprecated/shut down in 2024; Amoy is Polygon's
    // current testnet.
    amoy: {
      url: POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 80002,
    },
    polygon: {
      url: POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY || "",
      polygon: POLYGONSCAN_API_KEY || "",
    },
  },
};
