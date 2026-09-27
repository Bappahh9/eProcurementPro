import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProposals } from '../hooks/useProcurementData.js';
import { useWallet } from '../context/WalletContext.jsx';
import { EmptyState, Banner } from '../components/Common.jsx';

export default function Voting() {
  const { proposals, loading, refresh } = useProposals();
  const { procurementWrite, procurementRead, address, role } = useWallet();
  const [votingId, setVotingId] = useState(null);
  const [error, setError] = useState(null);
  const [votedIds, setVotedIds] = useState({});

  const maxVotes = Math.max(1, ...proposals.map((p) => Number(p.voteCount)));

  async function handleVote(proposalId) {
    setError(null);
    try {
      setVotingId(proposalId.toString());
      const alreadyVoted = await procurementRead.hasVotedOnProposal(proposalId, address);
      if (alreadyVoted) {
        setVotedIds((prev) => ({ ...prev, [proposalId.toString()]: true }));
        setError('You have already voted on this proposal.');
        return;
      }
      const tx = await procurementWrite.voteOnProposal(proposalId);
      await tx.wait();
      setVotedIds((prev) => ({ ...prev, [proposalId.toString()]: true }));
      refresh();
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Vote transaction failed.');
    } finally {
      setVotingId(null);
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1>Citizen voting</h1>
        {(role === 'mda' || role === 'bpp') && (
          <Link to="/proposals/new" className="btn btn-primary">
            Publish proposal
          </Link>
        )}
      </div>
      <p>
        Every wallet gets one vote per proposal. Votes are tallied on-chain, giving the community a transparent,
        tamper-evident say in which projects get funded before a tender is ever opened.
      </p>

      {error && <Banner kind="error">{error}</Banner>}

      {loading ? (
        <p>Loading proposals…</p>
      ) : proposals.length === 0 ? (
        <EmptyState>No proposals have been published yet.</EmptyState>
      ) : (
        proposals.map((p) => {
          const votes = Number(p.voteCount);
          const pct = Math.round((votes / maxVotes) * 100);
          const idStr = p.id.toString();
          return (
            <div className="panel" key={idStr}>
              <div className="tender-card-head">
                <h3 style={{ marginBottom: 0 }}>
                  #{idStr} · {p.title}
                </h3>
                {p.convertedToTender && <span className="tag status-completed">Now a tender</span>}
              </div>
              <p style={{ marginTop: 8 }}>{p.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="vote-bar-track">
                  <div className="vote-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="mono" style={{ whiteSpace: 'nowrap' }}>{votes} vote{votes === 1 ? '' : 's'}</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  className="btn btn-outline"
                  disabled={votingId === idStr || votedIds[idStr]}
                  onClick={() => handleVote(p.id)}
                >
                  {votedIds[idStr] ? 'Voted' : votingId === idStr ? 'Submitting…' : 'Vote for this project'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
