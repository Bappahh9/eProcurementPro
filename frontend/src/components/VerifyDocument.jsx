import React, { useEffect, useState } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import { hashFileSHA256 } from '../utils/hash.js';
import { shortenAddress } from '../utils/format.js';
import { Banner } from './Common.jsx';

/**
 * Lets anyone drop a file and check it against the SHA-256 fingerprint stored
 * on-chain for a tender document or one of its bids. The file never leaves the
 * browser: it is hashed locally and only the resulting digest is compared by
 * calling the contract's read-only verify functions (no gas, no transaction).
 */
export default function VerifyDocument({ tenderId, bids }) {
  const { procurementRead } = useWallet();
  const [target, setTarget] = useState('tender'); // 'tender' or a bid id
  const [fileName, setFileName] = useState('');
  const [computed, setComputed] = useState('');
  const [result, setResult] = useState(null); // null | true | false
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    setResult(null);
    setError(null);
    setComputed('');
    if (!file) {
      setFileName('');
      return;
    }
    setFileName(file.name);
    try {
      setComputed(await hashFileSHA256(file));
    } catch (err) {
      setError('Could not read that file.');
    }
  }

  // Re-check whenever the fingerprint or the comparison target changes
  useEffect(() => {
    if (!computed || !procurementRead) return;
    let cancelled = false;
    (async () => {
      setChecking(true);
      setError(null);
      try {
        const ok =
          target === 'tender'
            ? await procurementRead.verifyTenderDocument(tenderId, computed)
            : await procurementRead.verifyBidDocument(target, computed);
        if (!cancelled) setResult(ok);
      } catch (err) {
        if (!cancelled) setError(err?.shortMessage || err?.message || 'Verification failed.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [computed, target, tenderId, procurementRead]);

  return (
    <div className="panel">
      <h2>
        Verify a document <span className="badge-sha">SHA-256</span>
      </h2>
      <p>
        Choose a file to check it against the fingerprint recorded on the blockchain. A match proves the file is
        identical to the one originally submitted. Changing even a single character produces a completely different
        fingerprint. The file is hashed in your browser and is never uploaded.
      </p>

      <div className="form-grid">
        <div className="field">
          <label>Compare against</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="tender">Tender document (terms of reference)</option>
            {bids.map((b) => (
              <option key={b.id.toString()} value={b.id.toString()}>
                Bid #{b.id.toString()} by {shortenAddress(b.contractor)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>File to verify</label>
          <input type="file" onChange={handleFile} />
        </div>
      </div>

      {checking && <p>Checking…</p>}
      {error && <Banner kind="error">{error}</Banner>}

      {computed && (
        <div className="field">
          <label>Fingerprint of {fileName}</label>
          <div className="hash-chip">{computed}</div>
        </div>
      )}

      {!checking && result === true && (
        <Banner kind="info">
          <strong>Match.</strong> This file is identical to the document recorded on-chain. It has not been altered.
        </Banner>
      )}
      {!checking && result === false && (
        <Banner kind="error">
          <strong>No match.</strong> This file differs from the document recorded on-chain, or you are comparing it
          against the wrong item.
        </Banner>
      )}
    </div>
  );
}
