// Contract addresses and network config for the deployed Digital Plug
// Domains platform. Fill in the VITE_* addresses in .env after running
// `npm run deploy:wave1:amoy` (or :polygon) in contracts/dbws-suite.
//
// This platform runs on contracts/dbws-suite's PlugRegistry — a flat
// name.tld registry with a built-in reputation score, not the ENS-style
// namehash-tree DomainRegistry in contracts/domain-registry (superseded,
// see that suite's README). Registration is paid in USDC or discounted
// $PLUG (ERC-20 pull, not native currency), through PlugRegistrar's
// commit-reveal flow.

export const PLUG_REGISTRY_ADDRESS = import.meta.env.VITE_PLUG_REGISTRY_ADDRESS || "";
export const PLUG_REGISTRAR_ADDRESS = import.meta.env.VITE_PLUG_REGISTRAR_ADDRESS || "";
export const PLUG_RESOLVER_ADDRESS = import.meta.env.VITE_PLUG_RESOLVER_ADDRESS || "";
export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || "";
export const PLUG_TOKEN_ADDRESS = import.meta.env.VITE_PLUG_TOKEN_ADDRESS || "";

// TLDs this platform's UI offers, matching the flagship TLDs deployWave1.js
// enables on PlugRegistrar via configureTLD (registered without the leading
// dot on-chain). This is independent of TLDCatalog's 246-TLD marketplace
// catalog, which governs UserTLDRegistry/TLD-as-NFT ownership, not direct
// name.tld registration.
export const SUPPORTED_TLDS = [".plug", ".dbws"];

export const ACTIVE_NETWORK = import.meta.env.VITE_NETWORK === "polygon" ? "polygon" : "amoy";

export const NETWORKS = {
  amoy: {
    chainIdDecimal: 80002,
    chainId: "0x13882",
    chainName: "Polygon Amoy Testnet",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com"],
  },
  polygon: {
    chainIdDecimal: 137,
    chainId: "0x89",
    chainName: "Polygon Mainnet",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: ["https://polygon-rpc.com"],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
};

export const PLUG_REGISTRY_ABI = [
  "function domainHash(string name_, string tld) pure returns (bytes32)",
  "function isAvailable(string name_, string tld) view returns (bool)",
  "function isExpired(uint256 tokenId) view returns (bool)",
  "function nameToTokenId(bytes32) view returns (uint256)",
  "function domains(uint256 tokenId) view returns (string name, string tld, uint64 expiresAt, uint64 registeredAt, uint16 reputation, address resolver)",
  "function fullName(uint256 tokenId) view returns (string)",
  "function getReputation(uint256 tokenId) view returns (uint256)",
  "function setResolver(uint256 tokenId, address resolver)",
  "function releaseExpired(uint256 tokenId)",
  "function GRACE_PERIOD() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function REGISTRAR_ROLE() view returns (bytes32)",
  "function REPUTATION_ROLE() view returns (bytes32)",
  "event DomainRegistered(uint256 indexed tokenId, string name, string tld, address indexed owner, uint64 expiresAt)",
  "event DomainRenewed(uint256 indexed tokenId, uint64 newExpiry)",
  "event ResolverSet(uint256 indexed tokenId, address resolver)",
];

export const PLUG_REGISTRAR_ABI = [
  "function makeCommitment(string name_, string tld, address buyer, bytes32 secret) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function commitments(bytes32) view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function maxCommitmentAge() view returns (uint256)",
  "function quote(string name_, string tld, uint8 years_, bool payInPlug) view returns (uint256 total)",
  "function registerDomain(string name_, string tld, bytes32 secret, uint8 years_, bool payInPlug, address affiliate) returns (uint256 tokenId)",
  "function renewDomain(uint256 tokenId, string name_, string tld, uint8 years_, bool payInPlug)",
  "function tldConfig(string) view returns (bool enabled, uint256 priceUSDC, uint256 pricePLUG, uint256 premium3Char, uint256 premium4Char)",
  "event DomainCommitted(bytes32 indexed commitment, address indexed sender)",
  "event Registered(uint256 indexed tokenId, string name, string tld, address indexed buyer, uint8 years_, bool paidInPlug)",
  "event Renewed(uint256 indexed tokenId, uint8 years_)",
];

export const PLUG_RESOLVER_ABI = [
  "function setAddress(uint256 tokenId, address a)",
  "function addr(uint256) view returns (address)",
  "function setText(uint256 tokenId, string key, string value)",
  "function text(uint256 tokenId, string key) view returns (string)",
  "function setContenthash(uint256 tokenId, bytes hash)",
  "function contenthash(uint256) view returns (bytes)",
  "function resolve(string name_, string tld) view returns (address)",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
