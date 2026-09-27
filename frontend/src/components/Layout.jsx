import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { formatNaira, shortenAddress } from '../utils/format.js';

const ROLE_LABELS = {
  bpp: 'BPP Admin',
  mda: 'MDA Officer',
  contractor: 'Contractor',
  citizen: 'Citizen',
  unknown: '—',
};

export default function Layout({ children }) {
  const { address, engnBalance, role, onCorrectNetwork } = useWallet();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EP</div>
          <div>
            <div className="brand-text">EProcurementPro</div>
            <div className="brand-sub">Sepolia testnet</div>
          </div>
        </div>

        <nav className="nav-group">
          <div className="nav-label">Overview</div>
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/tenders" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Tenders
          </NavLink>
          <NavLink to="/voting" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Citizen voting
          </NavLink>
        </nav>

        {(role === 'mda' || role === 'bpp') && (
          <nav className="nav-group">
            <div className="nav-label">MDA</div>
            <NavLink to="/proposals/new" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              New proposal
            </NavLink>
            <NavLink to="/tenders/new" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Open a tender
            </NavLink>
          </nav>
        )}

        {role === 'bpp' && (
          <nav className="nav-group">
            <div className="nav-label">BPP</div>
            <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Administration
            </NavLink>
          </nav>
        )}

        <div className="sidebar-footer">
          EBDF Tier 3.0 prototype
          <br />
          Bureau of Public Procurement
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div />
          <WalletChip address={address} balance={engnBalance} role={role} onCorrectNetwork={onCorrectNetwork} />
        </div>
        {children}
      </main>
    </div>
  );
}

function WalletChip({ address, balance, role, onCorrectNetwork }) {
  if (!address) return null;
  return (
    <div className="wallet-chip">
      <span className={`wallet-dot${onCorrectNetwork ? ' connected' : ''}`} />
      <span className="wallet-address">{shortenAddress(address)}</span>
      <span className="wallet-balance">{formatNaira(balance)}</span>
      <span className="role-pill">{ROLE_LABELS[role] || role}</span>
    </div>
  );
}
