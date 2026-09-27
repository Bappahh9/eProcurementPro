import React from 'react';
import { useWallet } from '../context/WalletContext.jsx';

export default function ConnectGate({ children }) {
  const { hasMetaMask, address, connecting, error, connect, onCorrectNetwork, switchToSepolia, contractsConfigured } =
    useWallet();

  if (!address) {
    return (
      <div className="center-screen">
        <div className="panel landing-card">
          <div className="brand-mark" style={{ margin: '0 auto 16px', color: '#96721f', borderColor: '#96721f' }}>
            EP
          </div>
          <h1>EProcurementPro</h1>
          <p style={{ margin: '0 auto 20px' }}>
            Connect your wallet to access the Bureau of Public Procurement's blockchain-based tendering system on the
            Sepolia testnet.
          </p>
          {!hasMetaMask ? (
            <p style={{ color: '#9c3d2b' }}>
              No wallet extension was found. Install{' '}
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                MetaMask
              </a>{' '}
              and reload this page.
            </p>
          ) : (
            <button className="btn btn-primary btn-block" onClick={connect} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
          {error && (
            <p style={{ color: '#9c3d2b', marginTop: 14 }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (!onCorrectNetwork) {
    return (
      <div className="center-screen">
        <div className="panel landing-card">
          <h1>Wrong network</h1>
          <p style={{ margin: '0 auto 20px' }}>
            This dApp runs on the Sepolia test network. Switch networks in your wallet to continue.
          </p>
          <button className="btn btn-gold btn-block" onClick={switchToSepolia}>
            Switch to Sepolia
          </button>
          {error && <p style={{ color: '#9c3d2b', marginTop: 14 }}>{error}</p>}
        </div>
      </div>
    );
  }

  if (!contractsConfigured) {
    return (
      <div className="center-screen">
        <div className="panel landing-card">
          <h1>Contracts not configured</h1>
          <p>
            Deploy <code>eNGN.sol</code> and <code>EProcurementPro.sol</code>, then paste their addresses into{' '}
            <code>src/config/contracts.js</code> before using the app. See the README for step-by-step instructions.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
