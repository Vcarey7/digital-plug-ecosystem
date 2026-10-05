// Hand-written ABIs matching contracts/dbws-registry-suite exactly (as
// compiled -- see that project's artifacts/ for the generated source of
// truth if these ever drift; PHASE2c's hard rule is to STOP and report a
// mismatch rather than patch around one).

export const PLUG_REGISTRY_ABI = [
  'function key(string tld, string name) pure returns (bytes32)',
  'function isAvailable(string tld, string name) view returns (bool)',
  'function resolve(string tld, string name) view returns (address)',
  'function fullName(uint256 tokenId) view returns (string)',
  'function nameToId(bytes32) view returns (uint256)',
  'function domainOf(uint256) view returns (string tld, string name, address owner, uint256 registered, uint256 expires, bool transferable, bool lendable, address lockedBy, uint256 noteId, string metadataURI)',
  'function registrationFee(string tld) view returns (uint256)',
  'function transferFee(string tld) view returns (uint256)',
  'function tldEnabled(string tld) view returns (bool)',
  'function makeCommitment(string tld, string name, address buyer, bytes32 secret) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function commitments(bytes32) view returns (uint256)',
  'function minCommitmentAge() view returns (uint256)',
  'function maxCommitmentAge() view returns (uint256)',
  'function registerDomain(string tld, string name, address to, uint64 yearsCount, string metadataURI, bytes32 secret) returns (uint256 tokenId)',
  'function renewDomain(uint256 tokenId, uint64 yearsCount)',
  'function transferDomain(uint256 tokenId, address newOwner)',
  'function lockForLending(uint256 tokenId, address lender, uint256 noteId)',
  'function unlock(uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function nextTokenId() view returns (uint256)',
  'event DomainRegistered(uint256 indexed tokenId, string tld, string name, address indexed owner, uint256 expires)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export const ENTITY_REGISTRY_ABI = [
  'function registrationFee() view returns (uint256)',
  'function registerEntity(string entityName, string entityType, string stateOfFormation, string einHash, uint256 formationDate, string metadataURI) returns (uint256 tokenId)',
  'function linkDomain(uint256 tokenId, string domain)',
  'function lockForLending(uint256 tokenId, uint256 noteId, address lender)',
  'function entities(uint256) view returns (string entityName, string entityType, string stateOfFormation, string einHash, uint256 formationDate, uint256 registrationDate, address owner, bool active, bool lendable, uint256 linkedNoteId, string metadataURI)',
  'function getLinkedDomains(uint256 tokenId) view returns (string[])',
  'function getOwnerEntities(address account) view returns (uint256[])',
  'event EntityRegistered(uint256 indexed tokenId, string entityName, address indexed owner, uint256 timestamp)',
];

export const IP_REGISTRY_ABI = [
  'function registrationFee() view returns (uint256)',
  'function registerIP(string title, uint8 ipType, string descriptionHash, bytes32 contentHash, uint256 creationDate, string metadataURI) returns (uint256 tokenId)',
  'function createLicense(uint256 ipTokenId, address licensee, string licenseType, uint256 duration, uint256 royaltyRate)',
  'function ipAssets(uint256) view returns (string title, uint8 ipType, string descriptionHash, bytes32 contentHash, uint256 creationDate, uint256 registrationDate, address creator, address currentOwner, bool licensed, bool lendable, uint256 valuation, uint256 linkedNoteId, string metadataURI)',
  'function licenseCount(uint256 tokenId) view returns (uint256)',
  'function licenses(uint256, uint256) view returns (uint256 ipTokenId, address licensor, address licensee, string licenseType, uint256 startDate, uint256 endDate, uint256 royaltyRate, bool active)',
  'function getOwnerIP(address account) view returns (uint256[])',
  'event IPRegistered(uint256 indexed tokenId, string title, uint8 ipType, address indexed creator, bytes32 contentHash, uint256 timestamp)',
];

export const NOTE_REGISTRY_ABI = [
  'function notes(uint256) view returns (uint256 noteId, uint8 noteType, address borrower, address lender, uint256 principal, uint256 interestRate, uint256 originationDate, uint256 maturityDate, uint256 totalRepaid, uint8 status, uint8 collateralType, uint256 collateralTokenId, uint256 ltv, bool transferable, address currentHolder)',
  'function getBorrowerNotes(address b) view returns (uint256[])',
  'function lenderNotes(address, uint256) view returns (uint256)',
  'function getPaymentHistory(uint256 noteId) view returns (tuple(uint256 noteId, uint256 amount, uint256 timestamp, uint256 principalPortion, uint256 interestPortion)[])',
  'function getPortfolioHealth() view returns (uint256 totalValue, uint256 originated, uint256 defaulted, uint256 repaid)',
];

export const LICENSE_REGISTRY_ABI = [
  'function registrationFee() view returns (uint256)',
  'function registerLicense(string licenseNumber, string stateCode, uint8 licenseType, string businessName, string businessAddress, uint256 issueDate, uint256 expirationDate, string metadataURI) returns (uint256 tokenId)',
  'function logComplianceEvent(uint256 tokenId, string eventHash)',
  'function licenses(uint256) view returns (string licenseNumber, string stateCode, uint8 licenseType, string businessName, string businessAddress, address registeredOwner, uint256 issueDate, uint256 expirationDate, uint256 registrationDate, uint8 status, bool lendable, uint256 linkedNoteId, uint256 estimatedValue, string metadataURI)',
  'function getComplianceEvents(uint256 tokenId) view returns (string[])',
  'function getOperatorLicenses(address op) view returns (uint256[])',
  'event LicenseRegistered(uint256 indexed tokenId, string licenseNumber, string stateCode, address indexed operator, uint256 expirationDate)',
];

export const COMMUNITY_REGISTRY_ABI = [
  'function tierFees(uint8) view returns (uint256)',
  'function joinCommunity(string displayName, uint8 tier, string metadataURI) returns (uint256 tokenId)',
  'function upgradeTier(uint8 newTier)',
  'function walletToTokenId(address) view returns (uint256)',
  'function members(uint256) view returns (address wallet, string displayName, uint8 tier, uint8 order, uint256 joinDate, uint256 tierUpgradeDate, uint256 contributionScore, uint256 reputationScore, uint256 votingPower, bool active, bool soulbound, string metadataURI)',
  'function getAchievements(uint256 tokenId) view returns (string[])',
  'function votingPowerOf(address wallet) view returns (uint256)',
  'event MemberJoined(uint256 indexed tokenId, address indexed wallet, uint8 tier, uint256 timestamp)',
];

export const REVENUE_ROUTER_ABI = [
  'function balance() view returns (uint256)',
  'function treasury() view returns (address)',
];

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export const ABIS = {
  PlugRegistry: PLUG_REGISTRY_ABI,
  EntityRegistry: ENTITY_REGISTRY_ABI,
  IPRegistry: IP_REGISTRY_ABI,
  NoteRegistry: NOTE_REGISTRY_ABI,
  LicenseRegistry: LICENSE_REGISTRY_ABI,
  CommunityRegistry: COMMUNITY_REGISTRY_ABI,
  RevenueRouter: REVENUE_ROUTER_ABI,
};

export const TIER_LABELS = ['Community Member', 'Plug Member', 'The Orders', 'Founding Member'];
export const IP_TYPE_LABELS = [
  'Software', 'Creative Work', 'Brand Asset', 'Business Method',
  'Technical Innovation', 'Domain Portfolio', 'Knowledge Base',
  'Music', 'Film/Video', 'Character IP',
];
export const LICENSE_TYPE_LABELS = [
  'Adult Use Retail', 'Medical Dispensary', 'Delivery', 'Cultivation (Indoor)',
  'Cultivation (Outdoor)', 'Manufacturing', 'Distribution', 'Laboratory', 'Lounge', 'Other',
];
export const NOTE_TYPE_LABELS = ['Fixed Term', 'Asset Backed', 'Revenue Participation', 'Community'];
export const NOTE_STATUS_LABELS = ['Active', 'Repaid', 'Defaulted', 'Restructured', 'Sold'];
