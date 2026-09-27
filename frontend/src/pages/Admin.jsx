import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import { Banner } from '../components/Common.jsx';
import { parseNaira } from '../utils/format.js';

export default function Admin() {
  const { procurementWrite, engnWrite, role } = useWallet();

  if (role !== 'bpp') {
    return <Banner kind="warn">Only the BPP admin wallet (the contract owner) can access this page.</Banner>;
  }

  return (
    <div>
      <h1>Administration</h1>
      <p>Manage who may act as an MDA or contractor, and fund wallets with test eNGN for demonstration purposes.</p>

      <RoleForm
        title="Register an MDA"
        description="Grants a wallet permission to publish proposals and open tenders."
        action={(addr) => procurementWrite.registerMDA(addr)}
        actionLabel="Register as MDA"
      />

      <RoleForm
        title="Register a contractor"
        description="Grants a wallet permission to submit bids on open tenders."
        action={(addr) => procurementWrite.registerContractor(addr)}
        actionLabel="Register as contractor"
      />

      <MintForm engnWrite={engnWrite} />
    </div>
  );
}

function RoleForm({ title, description, action, actionLabel }) {
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Enter a valid wallet address (0x…40 hex characters).');
      return;
    }
    try {
      setStatus('sending');
      const tx = await action(address);
      await tx.wait();
      setAddress('');
      setStatus('done');
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Transaction failed.');
      setStatus('idle');
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h3>{title}</h3>
      <p>{description}</p>
      {error && <Banner kind="error">{error}</Banner>}
      <div className="field">
        <label>Wallet address</label>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" />
      </div>
      <button className="btn btn-primary" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : actionLabel}
      </button>
      {status === 'done' && <p style={{ color: '#144a38', marginTop: 10 }}>Done.</p>}
    </form>
  );
}

function MintForm({ engnWrite }) {
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!/^0x[a-fA-F0-9]{40}$/.test(address) || !amount) {
      setError('Enter a valid wallet address and amount.');
      return;
    }
    try {
      setStatus('sending');
      const tx = await engnWrite.mint(address, parseNaira(amount));
      await tx.wait();
      setAddress('');
      setAmount('');
      setStatus('done');
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Transaction failed.');
      setStatus('idle');
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h3>Fund a wallet with eNGN</h3>
      <p>Mints test eNGN so MDA wallets can escrow tender budgets during evaluation/demonstration.</p>
      {error && <Banner kind="error">{error}</Banner>}
      <div className="form-grid">
        <div className="field">
          <label>Wallet address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" />
        </div>
        <div className="field">
          <label>Amount (eNGN)</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000000" />
        </div>
      </div>
      <button className="btn btn-gold" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Minting…' : 'Mint eNGN'}
      </button>
      {status === 'done' && <p style={{ color: '#144a38', marginTop: 10 }}>Done.</p>}
    </form>
  );
}
