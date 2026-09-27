import React from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { useTenders, useProposals } from '../hooks/useProcurementData.js';
import { TenderCard, EmptyState } from '../components/Common.jsx';
import { formatNaira } from '../utils/format.js';

const ROLE_INTRO = {
  bpp: 'You are signed in as the Bureau of Public Procurement (BPP) admin. Register MDAs and contractors, score bids, and award tenders from the Administration page.',
  mda: 'You are signed in as an MDA officer. Publish citizen proposals, open funded tenders and track bids.',
  contractor: 'You are signed in as a registered contractor. Browse open tenders and submit bids with a hashed technical document.',
  citizen: 'You are signed in as a citizen. Vote on proposed projects and track public tenders for transparency.',
  unknown: 'Checking your role on-chain…',
};

export default function Dashboard() {
  const { role, engnBalance } = useWallet();
  const { tenders, loading } = useTenders();
  const { proposals } = useProposals();

  const openTenders = tenders.filter((t) => Number(t.status) === 0);
  const awardedTenders = tenders.filter((t) => Number(t.status) === 2 || Number(t.status) === 3);
  const totalEscrowed = tenders.reduce((sum, t) => sum + t.budget, 0n);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>{ROLE_INTRO[role]}</p>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-value">{tenders.length}</div>
          <div className="stat-label">Total tenders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{openTenders.length}</div>
          <div className="stat-label">Open for bidding</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{awardedTenders.length}</div>
          <div className="stat-label">Awarded / completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{proposals.length}</div>
          <div className="stat-label">Citizen proposals</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatNaira(totalEscrowed)}</div>
          <div className="stat-label">Total escrowed in eNGN</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatNaira(engnBalance)}</div>
          <div className="stat-label">Your eNGN balance</div>
        </div>
      </div>

      <div className="topbar" style={{ marginBottom: 12 }}>
        <h2 style={{ marginBottom: 0 }}>Recent tenders</h2>
        <Link to="/tenders" className="btn btn-outline">
          View all
        </Link>
      </div>

      {loading ? (
        <p>Loading tenders from the chain…</p>
      ) : tenders.length === 0 ? (
        <EmptyState>No tenders have been opened yet.</EmptyState>
      ) : (
        tenders.slice(0, 3).map((t) => <TenderCard key={t.id.toString()} tender={t} />)
      )}
    </div>
  );
}
