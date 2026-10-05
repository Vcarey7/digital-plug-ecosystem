import { ethers } from 'ethers';

// USDC is 6 decimals across the whole registry suite (MockUSDC + real USDC).
export const USDC_DECIMALS = 6;

export function formatUSDC(raw) {
  if (raw == null) return '—';
  return `$${Number(ethers.formatUnits(raw, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function parseUSDC(input) {
  return ethers.parseUnits(String(input || '0'), USDC_DECIMALS);
}

export function formatDate(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n) return '—';
  return new Date(n * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function isExpired(unixSeconds, graceDays = 30) {
  const n = Number(unixSeconds);
  if (!n) return false;
  return Date.now() / 1000 > n + graceDays * 86400;
}
