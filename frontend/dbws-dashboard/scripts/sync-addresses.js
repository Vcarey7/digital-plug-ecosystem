#!/usr/bin/env node
// Copies contracts/dbws-registry-suite/deployments/<network>/{addresses,deployment}.json
// into public/addresses/<network>.json so the dashboard can fetch it at
// runtime without ever hardcoding an address in a component. Re-run this
// any time you redeploy or want to point the dashboard at a different
// network's addresses.
//
//   node scripts/sync-addresses.js <network>   (default: localhost)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const network = process.argv[2] || 'localhost';
const suiteDir = path.resolve(__dirname, '..', '..', '..', 'contracts', 'dbws-registry-suite', 'deployments', network);
const addrPath = path.join(suiteDir, 'addresses.json');
const deployPath = path.join(suiteDir, 'deployment.json');
const manifestPath = path.join(suiteDir, 'tld-manifest.json');

if (!existsSync(addrPath)) {
  console.error(`No deployment found for "${network}" at ${addrPath}`);
  console.error('Deploy contracts/dbws-registry-suite first: npx hardhat run scripts/deploy.js --network ' + network);
  process.exit(1);
}

const addresses = JSON.parse(readFileSync(addrPath, 'utf8'));
const deployment = JSON.parse(readFileSync(deployPath, 'utf8'));

const outDir = path.resolve(__dirname, '..', 'public', 'addresses');
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${network}.json`);
writeFileSync(outPath, JSON.stringify({ network, chainId: deployment.chainId, usdc: deployment.usdc, contracts: addresses }, null, 2));
console.log(`Synced ${network} addresses -> ${outPath}`);

// tld-manifest.json is optional -- it only exists after scripts/seedTLDs.js
// has been run for this network. The dashboard falls back to a manual TLD
// input (checking tldEnabled/registrationFee on-chain directly) when absent.
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const tldOutPath = path.join(outDir, `${network}-tlds.json`);
  writeFileSync(tldOutPath, JSON.stringify(manifest, null, 2));
  console.log(`Synced ${network} TLD manifest -> ${tldOutPath}`);
} else {
  console.log(`No tld-manifest.json for "${network}" (run scripts/seedTLDs.js to generate one) -- skipping.`);
}
