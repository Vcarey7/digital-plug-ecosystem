# Digital Plug Domains — Smart Contracts

> **⚠ Superseded — not the production registry.** This ENS-style namehash-tree
> registry was the first build in this repo, before the full DBWS contract
> suite existed. The project has since standardized on
> [`contracts/dbws-suite`](../dbws-suite)'s `PlugRegistry` (flat `name.tld` +
> built-in reputation score) as the canonical domain registry — it's what the
> TLD marketplace (`UserTLDRegistry`, `TLDAuctionEngine`, `TLDValuationOracle`,
> `TLDCatalog`'s 246-TLD catalog) and the credit/lending contracts
> (`CommunityCredit`, `BlockBondNFT`) are built and tested against. Kept here
> for reference and because the commit-reveal / authorized-registrar patterns
> below were carried forward into `PlugRegistrar` in `dbws-suite`. Do not
> deploy this suite as "the" registry — use `dbws-suite` instead.

An ERC-721 based web3 domain registry supporting TLDs and subdomains
(ENS-style namehash tree), deployed to Polygon. Domains are minted as NFTs;
owners can resolve them, add subdomains, renew before expiry, or let a
registration lapse.

## Contracts

- **`DomainRegistry.sol`** — core registry. TLD registration is restricted
  to a `tldRegistrar` address; domain registration is open to anyone via a
  **commit-reveal flow** (`commit` → wait `minCommitmentAge` → `registerDomain`)
  to prevent front-running, mirroring ENS. Subdomain registration is
  restricted to the parent domain's owner, so it isn't exposed to the same
  risk and doesn't need commit-reveal.
  - `registerDomainFor` / `renewDomainFor` — a second entry point restricted
    to addresses the owner has approved via `setAuthorizedRegistrar`. Payment
    contracts (`PlugRegistrar`, `BatchMinting`) call these instead of the
    public functions: since they're the immediate caller, `msg.sender` inside
    the registry would be the payment contract's own address, not the actual
    buyer, so the public commit-reveal path (which mints to and checks
    against `msg.sender`) can't be used safely through an intermediary.
- **`PublicResolver.sol`** — per-domain records: ETH/multi-coin address,
  text records (email, avatar, ...), IPFS content hash.
- **`BatchMinting.sol`** — registers many domains/subdomains in one
  transaction with a volume discount, via the authorized-registrar path.
- **`PlugRegistrar.sol`** — lets buyers pay for `.plug`/`.dbws` domains in
  USDC or discounted $PLUG instead of native currency, with affiliate
  referral tracking. Also goes through the authorized-registrar path.

## Setup

```bash
npm install
cp .env.example .env   # fill in PRIVATE_KEY and RPC URLs
```

## Commands

```bash
npm run compile
npm test
npm run deploy:amoy      # deploy to Polygon Amoy testnet
npm run deploy:polygon   # deploy to Polygon mainnet
```

`scripts/deploy.js` deploys `DomainRegistry`, `PublicResolver`, and
`BatchMinting`, authorizes `BatchMinting` as a registrar, registers the
`.plug` and `.dbws` TLDs, and — if `USDC_ADDRESS`/`PLUG_TOKEN_ADDRESS` are set
in `.env` — also deploys and authorizes `PlugRegistrar`.

## Key entry points

| Function | Purpose |
|---|---|
| `registerTLD(tld, owner, resolver, metadataURI)` | Register a new TLD (tldRegistrar only) |
| `makeDomainCommitment(tld, domain, owner, secret)` / `commit(hash)` | Step 1 of domain registration |
| `registerDomain(tld, domain, duration, resolver, metadataURI, secret)` | Step 2 of domain registration (payable) |
| `registerSubdomain(parentDomain, subdomain, owner, duration, resolver, metadataURI)` | Register a subdomain (parent owner only, payable) |
| `renewDomain(domainHash, duration)` | Extend a registration (owner only, payable) |
| `setResolver(domainHash, resolver)` | Change a domain's resolver contract |
| `getDomain(domainHash)` / `getOwnerDomains(owner)` / `isAvailable` via `domainExists` | Read-only lookups |
