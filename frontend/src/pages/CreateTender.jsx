import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { PROCUREMENT_ADDRESS } from '../config/contracts.js';
import { hashFileSHA256, hashTextSHA256 } from '../utils/hash.js';
import { parseNaira } from '../utils/format.js';
import { Banner } from '../components/Common.jsx';

export default function CreateTender() {
  const { engnWrite, procurementWrite, address, role, refreshBalance } = useWallet();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [days, setDays] = useState('7');
  const [proposalId, setProposalId] = useState('0');
  const [file, setFile] = useState(null);
  const [documentHash, setDocumentHash] = useState('');
  const [status, setStatus] = useState('idle'); // idle | hashing | approving | creating | done
  const [error, setError] = useState(null);
  const [createdId, setCreatedId] = useState(null);

  async function handleFileChange(e) {
    const selected = e.target.files?.[0];
    setFile(selected || null);
    setDocumentHash('');
    if (selected) {
      setStatus('hashing');
      const digest = await hashFileSHA256(selected);
      setDocumentHash(digest);
      setStatus('idle');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!engnWrite || !procurementWrite) {
      setError('Wallet not ready. Reconnect and try again.');
      return;
    }
    if (!title.trim() || !description.trim() || !budget) {
      setError('Please fill in the title, description and budget.');
      return;
    }

    try {
      let finalHash = documentHash;
      if (!finalHash) {
        finalHash = await hashTextSHA256(title + description + Date.now());
      }

      const budgetRaw = parseNaira(budget);
      const biddingWindowSeconds = Number(days) * 24 * 60 * 60;

      setStatus('approving');
      const approveTx = await engnWrite.approve(PROCUREMENT_ADDRESS, budgetRaw);
      await approveTx.wait();

      setStatus('creating');
      const tx = await procurementWrite.createTender(
        proposalId || 0,
        title,
        description,
        finalHash,
        budgetRaw,
        biddingWindowSeconds
      );
      const receipt = await tx.wait();

      // Pull the new tender id back out of the TenderCreated event
      let newId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = procurementWrite.interface.parseLog(log);
          if (parsed?.name === 'TenderCreated') {
            newId = parsed.args.tenderId.toString();
          }
        } catch {
          // not our event, ignore
        }
      }

      setCreatedId(newId);
      setStatus('done');
      refreshBalance();
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Transaction failed.');
      setStatus('idle');
    }
  }

  if (role !== 'mda' && role !== 'bpp') {
    return <Banner kind="warn">Only a registered MDA wallet can open a tender.</Banner>;
  }

  if (status === 'done') {
    return (
      <div className="panel">
        <h2>Tender opened</h2>
        <p>
          The tender was created and its budget escrowed in the EProcurementPro contract as {budget} eNGN.
        </p>
        <button className="btn btn-primary" onClick={() => navigate(createdId ? `/tenders/${createdId}` : '/tenders')}>
          View tender
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Open a tender</h1>
      <p>
        Opening a tender escrows its full budget in eNGN inside the EProcurementPro contract. Your wallet will be
        asked to approve the transfer, then confirm the tender creation — two signatures in total.
      </p>

      <form className="panel" onSubmit={handleSubmit}>
        {error && <Banner kind="error">{error}</Banner>}

        <div className="field">
          <label>Tender title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rehabilitation of Ikot Ekpene–Uyo road, Phase 1" />
        </div>

        <div className="field">
          <label>Description / scope of work</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe deliverables, materials and standards required." />
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Budget (eNGN)</label>
            <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="2500000" />
            <div className="hint">Escrowed in full when the tender is created.</div>
          </div>
          <div className="field">
            <label>Bidding window (days)</label>
            <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Linked citizen proposal ID (optional)</label>
          <input type="number" min="0" value={proposalId} onChange={(e) => setProposalId(e.target.value)} placeholder="0" />
          <div className="hint">Enter 0 if this tender wasn't sourced from citizen voting.</div>
        </div>

        <div className="field">
          <label>Tender / terms-of-reference document</label>
          <input type="file" onChange={handleFileChange} />
          <div className="hint">
            Hashed locally with SHA-256 in your browser — only the fingerprint below is sent on-chain.
          </div>
          {status === 'hashing' && <div className="hint">Hashing document…</div>}
          {documentHash && <div className="hash-chip" style={{ marginTop: 8 }}>{documentHash}</div>}
        </div>

        <button className="btn btn-primary" type="submit" disabled={status === 'approving' || status === 'creating'}>
          {status === 'approving' && 'Approving eNGN escrow…'}
          {status === 'creating' && 'Creating tender…'}
          {status === 'idle' && 'Approve escrow & open tender'}
        </button>
      </form>
    </div>
  );
}
