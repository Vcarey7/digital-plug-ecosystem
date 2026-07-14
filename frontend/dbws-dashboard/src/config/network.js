// Active network is picked at build/dev time via VITE_NETWORK (default
// "localhost" per PHASE2c's build order -- build and verify against a
// local Hardhat node first, no funded wallet needed). Contract addresses
// are never hardcoded here: they're fetched at runtime from
// /addresses/<network>.json, written by `npm run sync-addresses` (which
// copies contracts/dbws-registry-suite/deployments/<network>/addresses.json).
export const ACTIVE_NETWORK = import.meta.env.VITE_NETWORK || 'localhost';

export const NETWORKS = {
  localhost: {
    chainIdDecimal: 31337,
    chainId: '0x7a69',
    chainName: 'Hardhat Local',
    rpcUrls: ['http://localhost:8545'],
  },
  amoy: {
    chainIdDecimal: 80002,
    chainId: '0x13882',
    chainName: 'Polygon Amoy Testnet',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
  },
  polygon: {
    chainIdDecimal: 137,
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
};

export async function loadAddresses() {
  const res = await fetch(`/addresses/${ACTIVE_NETWORK}.json`);
  if (!res.ok) {
    throw new Error(
      `No synced addresses for "${ACTIVE_NETWORK}". Run: npm run sync-addresses ${ACTIVE_NETWORK}`
    );
  }
  return res.json();
}

// Optional -- only present once scripts/seedTLDs.js has been run for this
// network. Returns null (not a throw) when absent so callers can fall back
// to a manual TLD input checked directly on-chain.
export async function loadTldManifest() {
  try {
    const res = await fetch(`/addresses/${ACTIVE_NETWORK}-tlds.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
