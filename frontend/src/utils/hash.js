/**
 * Hash a File object with SHA-256 using the browser's native Web Crypto API,
 * returning a 0x-prefixed 32-byte hex digest suitable for passing to the
 * smart contract's `bytes32 documentHash` parameters.
 *
 * This is the client-side half of the integrity mechanism described in the
 * project methodology: bidders fingerprint their documents locally before
 * ever touching the chain, so only the digest — never the document itself —
 * is written on-chain.
 */
export async function hashFileSHA256(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(digest);
}

/** Hash a plain text string with SHA-256 (useful when there's no file to attach). */
export async function hashTextSHA256(text) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return bufferToHex(digest);
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return '0x' + hex;
}
