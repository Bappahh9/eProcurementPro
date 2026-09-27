import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { useTender, useBidsForTender } from '../hooks/useProcurementData.js';
import { StatusTag, Banner, EmptyState } from '../components/Common.jsx';
import { formatDate, formatNaira, parseNaira, shortenAddress, shortenHash, isDeadlinePassed } from '../utils/format.js';
import { hashFileSHA256, hashTextSHA256 } from '../utils/hash.js';

export default function TenderDetail() {
  const { id } = useParams();
  const { tender, loading, refresh: refreshTender } = useTender(id);
  const { bids, loading: bidsLoading, refresh: refreshBids } = useBidsForTender(id);
  const { procurementWrite, role, address } = useWallet();

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  function refreshAll() {
    refreshTender();
    refreshBids();
  }

  async function run(action, label) {
    setError(null);
    setBusy(label);
    try {
      await action();
      refreshAll();
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Transaction failed.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p>Loading tender…</p>;
  if (!tender || tender.id === 0n) return <EmptyState>Tender not found.</EmptyState>;

  const status = Number(tender.status);
  const deadlinePassed = isDeadlinePassed(tender.deadline);
  const isMDAOwner = role === 'mda' && tender.mda.toLowerCase() === address?.toLowerCase();
  const isBPP = role === 'bpp';

  return (
    <div>
      <div className="topbar">
        <h1>
          #{tender.id.toString()} · {tender.title}
        </h1>
        <StatusTag statusIndex={tender.status} />
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="panel">
        <p>{tender.description}</p>
        <div className="meta-row">
          <span>
            MDA: <strong className="mono">{shortenAddress(tender.mda)}</strong>
          </span>
          <span>
            Budget: <strong>{formatNaira(tender.budget)}</strong>
          </span>
          <span>
            Paid so far: <strong>{formatNaira(tender.amountPaid)}</strong>
          </span>
          <span>
            Deadline: <strong>{formatDate(tender.deadline)}</strong>
          </span>
        </div>
        <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
          <label>Terms-of-reference document hash</label>
          <div className="hash-chip">{tender.documentHash}</div>
        </div>
      </div>

      {status === 0 && deadlinePassed && (
        <Banner kind="warn">
          The bidding window has closed but the tender is still marked Open on-chain.{' '}
          <button
            className="btn btn-outline"
            style={{ marginLeft: 8 }}
            disabled={busy}
            onClick={() => run(() => procurementWrite.closeBidding(tender.id), 'close')}
          >
            {busy === 'close' ? 'Closing…' : 'Close bidding now'}
          </button>
        </Banner>
      )}

      {status === 0 && role === 'contractor' && !deadlinePassed && (
        <SubmitBidForm tenderId={tender.id} budget={tender.budget} onDone={refreshAll} />
      )}

      <div className="panel">
        <h2>Bids ({bids.length})</h2>
        {bidsLoading ? (
          <p>Loading bids…</p>
        ) : bids.length === 0 ? (
          <EmptyState>No bids have been submitted yet.</EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Contractor</th>
                <th>Amount</th>
                <th>Document</th>
                <th>Score</th>
                <th>Status</th>
                {isBPP && (status === 1 || status === 2) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bids.map((b) => (
                <BidRow
                  key={b.id.toString()}
                  bid={b}
                  tender={tender}
                  isBPP={isBPP}
                  busy={busy}
                  onScore={(bidId, score) =>
                    run(() => procurementWrite.scoreBid(tender.id, bidId, score), `score-${bidId}`)
                  }
                  onDisqualify={(bidId) =>
                    run(
                      () => procurementWrite.disqualifyBid(tender.id, bidId, 'Failed technical evaluation'),
                      `dq-${bidId}`
                    )
                  }
                  onAward={(bidId) =>
                    run(() => procurementWrite.awardTender(tender.id, bidId), `award-${bidId}`)
                  }
                  onAwardAndSettle={(bidId) =>
                    run(() => procurementWrite.awardAndSettle(tender.id, bidId), `settle-${bidId}`)
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {status === 2 && isBPP && (
        <MilestonePaymentForm tenderId={tender.id} remaining={tender.budget - tender.amountPaid} onDone={refreshAll} />
      )}

      {(isMDAOwner || isBPP) && (status === 0 || status === 1) && (
        <div className="panel">
          <h3>Cancel tender</h3>
          <p>Cancels the tender and refunds any un-spent escrow to the MDA.</p>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => run(() => procurementWrite.cancelTender(tender.id, 'Cancelled by MDA/BPP'), 'cancel')}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel tender & refund escrow'}
          </button>
        </div>
      )}
    </div>
  );
}

function BidRow({ bid, tender, isBPP, busy, onScore, onDisqualify, onAward, onAwardAndSettle }) {
  const [scoreInput, setScoreInput] = useState(bid.score?.toString() || '');
  const idStr = bid.id.toString();
  const status = Number(tender.status);

  return (
    <tr>
      <td>{idStr}</td>
      <td className="mono">{shortenAddress(bid.contractor)}</td>
      <td>{formatNaira(bid.amount)}</td>
      <td>
        <span className="hash-chip">{shortenHash(bid.documentHash)}</span>
      </td>
      <td>{bid.scored ? bid.score.toString() : '—'}</td>
      <td>{bid.disqualified ? 'Disqualified' : bid.scored ? 'Scored' : 'Pending'}</td>
      {isBPP && (status === 1 || status === 2) && (
        <td>
          {status === 1 && !bid.disqualified && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                min="0"
                max="100"
                style={{ width: 64 }}
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
              />
              <button
                className="btn btn-outline"
                disabled={busy}
                onClick={() => onScore(bid.id, Number(scoreInput))}
              >
                {busy === `score-${idStr}` ? 'Saving…' : 'Score'}
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => onDisqualify(bid.id)}>
                Disqualify
              </button>
              {bid.scored && (
                <>
                  <button className="btn btn-outline" disabled={busy} onClick={() => onAward(bid.id)}>
                    {busy === `award-${idStr}` ? 'Awarding…' : 'Award'}
                  </button>
                  <button className="btn btn-gold" disabled={busy} onClick={() => onAwardAndSettle(bid.id)}>
                    {busy === `settle-${idStr}` ? 'Settling…' : 'Award & pay in full'}
                  </button>
                </>
              )}
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

function SubmitBidForm({ tenderId, budget, onDone }) {
  const { procurementWrite } = useWallet();
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState(null);
  const [documentHash, setDocumentHash] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const selected = e.target.files?.[0];
    setFile(selected || null);
    if (selected) {
      setStatus('hashing');
      setDocumentHash(await hashFileSHA256(selected));
      setStatus('idle');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!amount) {
      setError('Enter your bid amount.');
      return;
    }
    try {
      setStatus('submitting');
      let finalHash = documentHash;
      if (!finalHash) finalHash = await hashTextSHA256(amount + Date.now());
      const tx = await procurementWrite.submitBid(tenderId, parseNaira(amount), finalHash);
      await tx.wait();
      setAmount('');
      setFile(null);
      setDocumentHash('');
      onDone();
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Transaction failed.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Submit a bid</h2>
      {error && <Banner kind="error">{error}</Banner>}
      <div className="form-grid">
        <div className="field">
          <label>Bid amount (eNGN, max {formatNaira(budget)})</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Technical/bid document</label>
          <input type="file" onChange={handleFileChange} />
          {status === 'hashing' && <div className="hint">Hashing document…</div>}
        </div>
      </div>
      {documentHash && <div className="hash-chip" style={{ marginBottom: 14 }}>{documentHash}</div>}
      <button className="btn btn-primary" type="submit" disabled={status !== 'idle'}>
        {status === 'submitting' ? 'Submitting bid…' : 'Submit bid'}
      </button>
    </form>
  );
}

function MilestonePaymentForm({ tenderId, remaining, onDone }) {
  const { procurementWrite } = useWallet();
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      setStatus('paying');
      const tx = await procurementWrite.releaseMilestonePayment(tenderId, parseNaira(amount));
      await tx.wait();
      setAmount('');
      onDone();
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Transaction failed.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h2>Release a milestone payment</h2>
      <p>Remaining escrow available: {formatNaira(remaining)}</p>
      {error && <Banner kind="error">{error}</Banner>}
      <div className="field">
        <label>Amount to release (eNGN)</label>
        <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <button className="btn btn-gold" type="submit" disabled={status !== 'idle'}>
        {status === 'paying' ? 'Releasing payment…' : 'Release payment to contractor'}
      </button>
    </form>
  );
}
