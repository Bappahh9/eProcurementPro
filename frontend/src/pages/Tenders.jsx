import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenders } from '../hooks/useProcurementData.js';
import { TenderCard, EmptyState } from '../components/Common.jsx';
import { useWallet } from '../context/WalletContext.jsx';

const FILTERS = ['All', 'Open', 'Closed', 'Awarded', 'Completed', 'Cancelled'];

export default function Tenders() {
  const { tenders, loading } = useTenders();
  const { role } = useWallet();
  const [filter, setFilter] = useState('All');

  const filtered =
    filter === 'All' ? tenders : tenders.filter((t) => FILTERS[Number(t.status) + 1] === filter);

  return (
    <div>
      <div className="topbar">
        <h1>Tenders</h1>
        {(role === 'mda' || role === 'bpp') && (
          <Link to="/tenders/new" className="btn btn-primary">
            Open a tender
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={filter === f ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading tenders from the chain…</p>
      ) : filtered.length === 0 ? (
        <EmptyState>No tenders match this filter.</EmptyState>
      ) : (
        filtered.map((t) => <TenderCard key={t.id.toString()} tender={t} />)
      )}
    </div>
  );
}
