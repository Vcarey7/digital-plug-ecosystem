// Contract addresses and network config for the deployed Digital Plug
// Domains platform. Fill in the VITE_* addresses in .env after running
// `npm run deploy:amoy` (or :polygon) in contracts/domain-registry.

export const DOMAIN_REGISTRY_ADDRESS = import.meta.env.VITE_DOMAIN_REGISTRY_ADDRESS || "";
export const PUBLIC_RESOLVER_ADDRESS = import.meta.env.VITE_PUBLIC_RESOLVER_ADDRESS || "";
export const BATCH_MINTING_ADDRESS = import.meta.env.VITE_BATCH_MINTING_ADDRESS || "";
export const PLUG_REGISTRAR_ADDRESS = import.meta.env.VITE_PLUG_REGISTRAR_ADDRESS || "";
export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || "";
export const PLUG_TOKEN_ADDRESS = import.meta.env.VITE_PLUG_TOKEN_ADDRESS || "";

// TLDs this platform's UI offers, matching contracts/domain-registry's
// deploy script (registered without the leading dot on-chain).
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

export const DOMAIN_REGISTRY_ABI = [
  "function namehash(string name) pure returns (bytes32)",
  "function makeDomainCommitment(string tld, string domain, address owner, bytes32 secret) pure returns (bytes32)",
  "function commit(bytes32 commitment)",
  "function registerDomain(string tld, string domain, uint256 duration, address resolver, string metadataURI, bytes32 secret) payable",
  "function registerSubdomain(string parentDomain, string subdomain, address owner, uint256 duration, address resolver, string metadataURI) payable",
  "function renewDomain(bytes32 domainHash, uint256 duration) payable",
  "function setResolver(bytes32 domainHash, address resolver)",
  "function getDomain(bytes32 domainHash) view returns (tuple(string name, bytes32 namehash, address owner, address resolver, uint256 expiry, bool isTLD, bytes32 parentHash, uint256 tokenId))",
  "function getOwnerDomains(address owner) view returns (bytes32[])",
  "function getSubdomains(bytes32 parentHash) view returns (bytes32[])",
  "function domainExists(bytes32) view returns (bool)",
  "function registeredTLDs(bytes32) view returns (bool)",
  "function baseDomainPrice() view returns (uint256)",
  "function baseSubdomainPrice() view returns (uint256)",
  "function baseTLDPrice() view returns (uint256)",
  "function minCommitmentAge() view returns (uint256)",
  "function maxCommitmentAge() view returns (uint256)",
  "function commitments(bytes32) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function owner() view returns (address)",
  "function tldRegistrar() view returns (address)",
  "event DomainRegistered(string indexed domain, bytes32 indexed domainHash, address indexed owner, uint256 expiry, uint256 tokenId)",
  "event SubdomainRegistered(string indexed subdomain, string parentDomain, bytes32 indexed subdomainHash, address indexed owner, uint256 expiry, uint256 tokenId)",
  "event DomainRenewed(bytes32 indexed domainHash, uint256 newExpiry)",
];

export const PUBLIC_RESOLVER_ABI = [
  "function setAddress(bytes32 domainHash, address newAddress)",
  "function addr(bytes32 domainHash) view returns (address)",
  "function setText(bytes32 domainHash, string key, string value)",
  "function text(bytes32 domainHash, string key) view returns (string)",
  "function setContentHash(bytes32 domainHash, string contentHash)",
  "function contentHash(bytes32 domainHash) view returns (string)",
  "function getAllRecords(bytes32 domainHash) view returns (string contentHashValue, address ethAddress, string email, string avatar, string description)",
];

export const BATCH_MINTING_ABI = [
  "function calculateBatchDomainCost(uint256 count, uint256 basePrice) view returns (uint256)",
  "function getBatchPricing(uint256 domainCount, uint256 subdomainCount) view returns (uint256 domainCost, uint256 subdomainCost, uint256 totalCost, uint256 savings)",
  "function batchRegisterDomains(tuple(string tld, string domain, uint256 duration, address resolver, string metadataURI)[] domains) payable",
  "function batchRegisterSubdomains(tuple(string parentDomain, string subdomain, address owner, uint256 duration, address resolver, string metadataURI)[] subdomains) payable",
  "function maxBatchSize() view returns (uint256)",
];

export const PLUG_REGISTRAR_ABI = [
  "function getPrice(string label, string tld, uint256 numYears) view returns (uint256)",
  "function register(string label, string tld, uint256 numYears, bool payInPlug, address referrer, string metadataURI)",
  "function renew(bytes32 domainHash, string originalTld, uint256 numYears, bool payInPlug)",
  "function plugRate() view returns (uint256)",
  "function plugDiscountBps() view returns (uint256)",
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
