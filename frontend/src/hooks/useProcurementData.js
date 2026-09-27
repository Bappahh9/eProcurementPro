import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../context/WalletContext.jsx';

/** Fetch every tender from the contract (fine for a prototype-scale tender count). */
export function useTenders() {
  const { procurementRead } = useWallet();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!procurementRead) return;
    setLoading(true);
    try {
      const count = await procurementRead.tenderCount();
      const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
      const results = await Promise.all(ids.map((id) => procurementRead.getTender(id)));
      setTenders(results.reverse()); // newest first
    } finally {
      setLoading(false);
    }
  }, [procurementRead]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tenders, loading, refresh };
}

export function useTender(tenderId) {
  const { procurementRead } = useWallet();
  const [tender, setTender] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!procurementRead || !tenderId) return;
    setLoading(true);
    try {
      const result = await procurementRead.getTender(tenderId);
      setTender(result);
    } finally {
      setLoading(false);
    }
  }, [procurementRead, tenderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tender, loading, refresh };
}

export function useBidsForTender(tenderId) {
  const { procurementRead } = useWallet();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!procurementRead || !tenderId) return;
    setLoading(true);
    try {
      const bidIds = await procurementRead.getBidsForTender(tenderId);
      const results = await Promise.all(bidIds.map((id) => procurementRead.getBid(id)));
      setBids(results);
    } finally {
      setLoading(false);
    }
  }, [procurementRead, tenderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bids, loading, refresh };
}

export function useProposals() {
  const { procurementRead } = useWallet();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!procurementRead) return;
    setLoading(true);
    try {
      const count = await procurementRead.proposalCount();
      const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
      const results = await Promise.all(ids.map((id) => procurementRead.getProposal(id)));
      setProposals(results.reverse());
    } finally {
      setLoading(false);
    }
  }, [procurementRead]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { proposals, loading, refresh };
}
