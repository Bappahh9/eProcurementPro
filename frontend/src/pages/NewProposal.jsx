import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import { Banner } from '../components/Common.jsx';

export default function NewProposal() {
  const { procurementWrite, role } = useWallet();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError('Please provide a title and description for citizens to vote on.');
      return;
    }
    try {
      setSubmitting(true);
      const tx = await procurementWrite.createProposal(title, description);
      await tx.wait();
      navigate('/voting');
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Transaction failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (role !== 'mda' && role !== 'bpp') {
    return <Banner kind="warn">Only a registered MDA wallet can publish a proposal for citizen voting.</Banner>;
  }

  return (
    <div>
      <h1>Publish a project proposal</h1>
      <p>
        Before opening a funded tender, put the candidate project to citizens for a vote. This is the e-participation
        step of the procurement lifecycle — it lets communities help prioritise which projects get funded.
      </p>

      <form className="panel" onSubmit={handleSubmit}>
        {error && <Banner kind="error">{error}</Banner>}
        <div className="field">
          <label>Project title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Borehole rehabilitation, Ward 4" />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain the need and expected community impact." />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Publishing…' : 'Publish for citizen voting'}
        </button>
      </form>
    </div>
  );
}
