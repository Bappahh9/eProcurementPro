import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ConnectGate from './components/ConnectGate.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tenders from './pages/Tenders.jsx';
import TenderDetail from './pages/TenderDetail.jsx';
import CreateTender from './pages/CreateTender.jsx';
import NewProposal from './pages/NewProposal.jsx';
import Voting from './pages/Voting.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <ConnectGate>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tenders" element={<Tenders />} />
          <Route path="/tenders/new" element={<CreateTender />} />
          <Route path="/tenders/:id" element={<TenderDetail />} />
          <Route path="/proposals/new" element={<NewProposal />} />
          <Route path="/voting" element={<Voting />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Layout>
    </ConnectGate>
  );
}
