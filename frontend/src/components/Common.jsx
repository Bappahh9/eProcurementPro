import React from 'react';
import { Link } from 'react-router-dom';
import { TENDER_STATUS_LABELS } from '../config/contracts.js';
import { formatDate, formatNaira, shortenHash } from '../utils/format.js';

export function StatusTag({ statusIndex }) {
  const label = TENDER_STATUS_LABELS[Number(statusIndex)] || 'Unknown';
  return <span className={`tag status-${label.toLowerCase()}`}>{label}</span>;
}

export function TenderCard({ tender }) {
  const label = (TENDER_STATUS_LABELS[Number(tender.status)] || 'unknown').toLowerCase();
  const paidPct = tender.budget > 0n ? Number((tender.amountPaid * 100n) / tender.budget) : 0;

  return (
    <Link to={`/tenders/${tender.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={`tender-card status-${label}`}>
        <div className="tender-card-head">
          <h3 style={{ marginBottom: 0 }}>
            #{tender.id.toString()} · {tender.title}
          </h3>
          <StatusTag statusIndex={tender.status} />
        </div>
        <p style={{ marginTop: 8, marginBottom: 6 }}>{tender.description}</p>
        <div className="meta-row">
          <span>
            Budget: <strong>{formatNaira(tender.budget)}</strong>
          </span>
          <span>
            Bidding deadline: <strong>{formatDate(tender.deadline)}</strong>
          </span>
          <span>
            Document: <span className="hash-chip">{shortenHash(tender.documentHash)}</span>
          </span>
        </div>
        {Number(tender.amountPaid) > 0 && (
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${paidPct}%` }} />
          </div>
        )}
      </div>
    </Link>
  );
}

export function Banner({ kind = 'info', children }) {
  return <div className={`banner banner-${kind}`}>{children}</div>;
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}
