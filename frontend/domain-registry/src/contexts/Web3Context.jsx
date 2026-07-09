import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  DOMAIN_REGISTRY_ADDRESS,
  PUBLIC_RESOLVER_ADDRESS,
  BATCH_MINTING_ADDRESS,
  PLUG_REGISTRAR_ADDRESS,
  DOMAIN_REGISTRY_ABI,
  PUBLIC_RESOLVER_ABI,
  BATCH_MINTING_ABI,
  PLUG_REGISTRAR_ABI,
  NETWORKS,
  ACTIVE_NETWORK,
} from '../config/contracts';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

const CONTRACTS = {
  domainRegistry: { address: DOMAIN_REGISTRY_ADDRESS, abi: DOMAIN_REGISTRY_ABI },
  publicResolver: { address: PUBLIC_RESOLVER_ADDRESS, abi: PUBLIC_RESOLVER_ABI },
  batchMinting: { address: BATCH_MINTING_ADDRESS, abi: BATCH_MINTING_ABI },
  plugRegistrar: { address: PLUG_REGISTRAR_ADDRESS, abi: PLUG_REGISTRAR_ABI },
};

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [network, setNetwork] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState('0');

  const targetNetwork = NETWORKS[ACTIVE_NETWORK];

  const refreshAccountState = useCallback(async (web3Provider, address) => {
    const web3Signer = await web3Provider.getSigner();
    const web3Network = await web3Provider.getNetwork();
    const accountBalance = await web3Provider.getBalance(address);

    setSigner(web3Signer);
    setNetwork(web3Network);
    setBalance(ethers.formatEther(accountBalance));
    setAccount(address);
    setIsConnected(true);
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);
      await refreshAccountState(web3Provider, accounts[0]);

      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', accounts[0]);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setNetwork(null);
    setBalance('0');
    setIsConnected(false);

    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
  };

  // Switch to the platform's target network (falls back to adding it if unknown)
  const switchNetwork = async (chainId = targetNetwork.chainIdDecimal) => {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    const hexChainId = `0x${chainId.toString(16)}`;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (error) {
      if (error.code === 4902) {
        const networkConfig = Object.values(NETWORKS).find((n) => n.chainId === hexChainId);
        if (networkConfig) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        }
      } else {
        throw error;
      }
    }
  };

  // Get a contract instance. Pass withSigner=true for write calls.
  const getContract = (contractName, withSigner = false) => {
    const entry = CONTRACTS[contractName];
    if (!entry) {
      throw new Error(`Unknown contract: ${contractName}`);
    }
    if (!entry.address) {
      throw new Error(
        `${contractName} address not configured. Set the matching VITE_..._ADDRESS in .env after deploying.`
      );
    }
    if (withSigner) {
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      return new ethers.Contract(entry.address, entry.abi, signer);
    }
    const readProvider = provider || new ethers.JsonRpcProvider(targetNetwork.rpcUrls[0]);
    return new ethers.Contract(entry.address, entry.abi, readProvider);
  };

  const isContractConfigured = (contractName) => Boolean(CONTRACTS[contractName]?.address);

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Format balance for display
  const formatBalance = (bal) => {
    const num = parseFloat(bal);
    if (num === 0) return '0';
    if (num < 0.001) return '< 0.001';
    return num.toFixed(3);
  };

  // Check if on correct network
  const isCorrectNetwork = () => {
    return Boolean(network) && Number(network.chainId) === targetNetwork.chainIdDecimal;
  };

  // Auto-connect on page load
  useEffect(() => {
    const autoConnect = async () => {
      const wasConnected = localStorage.getItem('walletConnected');
      const savedAddress = localStorage.getItem('walletAddress');

      if (wasConnected && savedAddress && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.includes(savedAddress)) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
            await refreshAccountState(web3Provider, savedAddress);
          }
        } catch (error) {
          console.error('Auto-connect failed:', error);
        }
      }
    };

    autoConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        return;
      }
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);
      await refreshAccountState(web3Provider, accounts[0]);
      localStorage.setItem('walletAddress', accounts[0]);
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [refreshAccountState]);

  const value = {
    // State
    account,
    provider,
    signer,
    network,
    balance,
    isConnecting,
    isConnected,

    // Actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    getContract,
    isContractConfigured,

    // Utilities
    formatAddress,
    formatBalance,
    isCorrectNetwork,

    // Constants
    targetNetwork,
    NETWORKS,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};
