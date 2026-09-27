import { ethers } from 'ethers';
import { TOKEN_DECIMALS } from '../config/contracts.js';

/** Format a raw on-chain token amount (bigint/string) as a Naira-style string, e.g. "₦2,500,000". */
export function formatNaira(rawAmount) {
  if (rawAmount === undefined || rawAmount === null) return '—';
  const asString = ethers.formatUnits(rawAmount, TOKEN_DECIMALS);
  const asNumber = Number(asString);
  return '₦' + asNumber.toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

/** Parse a human-entered Naira amount (e.g. "2500000") into raw token units for a tx. */
export function parseNaira(amountString) {
  return ethers.parseUnits(String(amountString || '0'), TOKEN_DECIMALS);
}

export function formatDate(unixSeconds) {
  const value = Number(unixSeconds);
  if (!value) return '—';
  return new Date(value * 1000).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function shortenAddress(address) {
  if (!address) return '';
  return address.slice(0, 6) + '…' + address.slice(-4);
}

export function shortenHash(hash) {
  if (!hash) return '';
  return hash.slice(0, 10) + '…' + hash.slice(-6);
}

export function isDeadlinePassed(unixSeconds) {
  return Date.now() / 1000 > Number(unixSeconds);
}
