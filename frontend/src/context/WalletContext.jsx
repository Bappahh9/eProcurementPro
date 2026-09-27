import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import {
  ENGN_ADDRESS,
  PROCUREMENT_ADDRESS,
  SEPOLIA_CHAIN_ID_DEC,
  SEPOLIA_CHAIN_ID_HEX,
  SEPOLIA_NETWORK_PARAMS,
} from '../config/contracts.js';
import engnAbi from '../abi/ENGN.json';
import procurementAbi from '../abi/EProcurementPro.json';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const [role, setRole] = useState('unknown'); // 'bpp' | 'mda' | 'contractor' | 'citizen' | 'unknown'
  const [engnBalance, setEngnBalance] = useState(null);

  const hasMetaMask = typeof window !== 'undefined' && Boolean(window.ethereum);
  const onCorrectNetwork = chainId === SEPOLIA_CHAIN_ID_DEC;
  const contractsConfigured =
    ENGN_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
    PROCUREMENT_ADDRESS !== '0x0000000000000000000000000000000000000000';

  // Read-only contract instances (work even before a wallet connects)
  const readProvider = useMemo(() => {
    if (!hasMetaMask) return null;
    return new ethers.BrowserProvider(window.ethereum);
  }, [hasMetaMask]);

  const engnRead = useMemo(() => {
    if (!readProvider || !contractsConfigured) return null;
    return new ethers.Contract(ENGN_ADDRESS, engnAbi, readProvider);
  }, [readProvider, contractsConfigured]);

  const procurementRead = useMemo(() => {
    if (!readProvider || !contractsConfigured) return null;
    return new ethers.Contract(PROCUREMENT_ADDRESS, procurementAbi, readProvider);
  }, [readProvider, contractsConfigured]);

  // Signer-bound contract instances (required for sending transactions)
  const engnWrite = useMemo(() => {
    if (!signer || !contractsConfigured) return null;
    return new ethers.Contract(ENGN_ADDRESS, engnAbi, signer);
  }, [signer, contractsConfigured]);

  const procurementWrite = useMemo(() => {
    if (!signer || !contractsConfigured) return null;
    return new ethers.Contract(PROCUREMENT_ADDRESS, procurementAbi, signer);
  }, [signer, contractsConfigured]);

  const refreshBalance = useCallback(async () => {
    if (!engnRead || !address) return;
    try {
      const raw = await engnRead.balanceOf(address);
      setEngnBalance(raw);
    } catch (e) {
      // Silently ignore — likely wrong network or contracts not yet deployed
    }
  }, [engnRead, address]);

  const refreshRole = useCallback(async () => {
    if (!procurementRead || !address) {
      setRole('unknown');
      return;
    }
    try {
      const [owner, isMDA, isContractor] = await Promise.all([
        procurementRead.owner(),
        procurementRead.isMDA(address),
        procurementRead.isContractor(address),
      ]);
      if (owner.toLowerCase() === address.toLowerCase()) {
        setRole('bpp');
      } else if (isMDA) {
        setRole('mda');
      } else if (isContractor) {
        setRole('contractor');
      } else {
        setRole('citizen');
      }
    } catch (e) {
      setRole('unknown');
    }
  }, [procurementRead, address]);

  const connect = useCallback(async () => {
    setError(null);
    if (!hasMetaMask) {
      setError('No wallet extension detected. Please install MetaMask to continue.');
      return;
    }
    setConnecting(true);
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const network = await browserProvider.getNetwork();
      const activeSigner = await browserProvider.getSigner();

      setProvider(browserProvider);
      setSigner(activeSigner);
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
    } catch (e) {
      setError(e?.message || 'Wallet connection was rejected.');
    } finally {
      setConnecting(false);
    }
  }, [hasMetaMask]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setRole('unknown');
    setEngnBalance(null);
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!hasMetaMask) return;
    setError(null);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      // 4902 = chain not yet added to the wallet
      if (switchError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [SEPOLIA_NETWORK_PARAMS],
          });
        } catch (addError) {
          setError(addError?.message || 'Could not add the Sepolia network.');
        }
      } else {
        setError(switchError?.message || 'Could not switch to the Sepolia network.');
      }
    }
  }, [hasMetaMask]);

  // React to account / network changes triggered from inside MetaMask itself
  useEffect(() => {
    if (!hasMetaMask) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAddress(accounts[0]);
      }
    };
    const handleChainChanged = (hexChainId) => {
      setChainId(parseInt(hexChainId, 16));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [hasMetaMask, disconnect]);

  // Re-derive the signer whenever the address or chain changes so writes stay in sync
  useEffect(() => {
    if (!hasMetaMask || !address) return;
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    setProvider(browserProvider);
    browserProvider.getSigner().then(setSigner).catch(() => {});
  }, [hasMetaMask, address, chainId]);

  useEffect(() => {
    refreshRole();
    refreshBalance();
  }, [refreshRole, refreshBalance]);

  const value = {
    hasMetaMask,
    provider,
    signer,
    address,
    chainId,
    onCorrectNetwork,
    contractsConfigured,
    connecting,
    error,
    role,
    engnBalance,
    connect,
    disconnect,
    switchToSepolia,
    refreshBalance,
    refreshRole,
    engnRead,
    engnWrite,
    procurementRead,
    procurementWrite,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
