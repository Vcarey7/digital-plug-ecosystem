import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ACTIVE_NETWORK, NETWORKS, loadAddresses } from '../config/network';
import { ABIS, ERC20_ABI } from '../config/abis';

const Web3Context = createContext();

export const useWeb3 = () => {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used within a Web3Provider');
  return ctx;
};

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [addresses, setAddresses] = useState(null); // { contracts: {...}, usdc }
  const [addressesError, setAddressesError] = useState(null);

  const targetNetwork = NETWORKS[ACTIVE_NETWORK];

  // Load deployment addresses once on mount -- never hardcoded, always from
  // the synced /addresses/<network>.json (see scripts/sync-addresses.js).
  useEffect(() => {
    loadAddresses()
      .then(setAddresses)
      .catch((e) => setAddressesError(e.message));
  }, []);

  const refreshAccountState = useCallback(async (web3Provider, address) => {
    const web3Signer = await web3Provider.getSigner();
    const net = await web3Provider.getNetwork();
    setSigner(web3Signer);
    setChainId(Number(net.chainId));
    setAccount(address);
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) throw new Error('No wallet found (window.ethereum missing)');
    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length === 0) throw new Error('No accounts returned');
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);
      await refreshAccountState(web3Provider, accounts[0]);
      localStorage.setItem('dbws:walletConnected', 'true');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    localStorage.removeItem('dbws:walletConnected');
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetNetwork.chainId }],
      });
    } catch (error) {
      if (error.code === 4902 && targetNetwork.rpcUrls) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [targetNetwork] });
      } else {
        throw error;
      }
    }
  };

  useEffect(() => {
    const autoConnect = async () => {
      if (localStorage.getItem('dbws:walletConnected') && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
            await refreshAccountState(web3Provider, accounts[0]);
          }
        } catch {
          // ignore -- user can reconnect manually
        }
      }
    };
    autoConnect();
  }, [refreshAccountState]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) return disconnectWallet();
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);
      await refreshAccountState(web3Provider, accounts[0]);
    };
    const handleChainChanged = () => window.location.reload();
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [refreshAccountState]);

  // Get a contract instance by registry name ("PlugRegistry", "usdc", ...).
  // Pass withSigner=true for write calls.
  const getContract = (name, withSigner = false) => {
    if (!addresses) throw new Error('Addresses not loaded yet');
    const isUsdc = name === 'usdc';
    const address = isUsdc ? addresses.usdc : addresses.contracts[name];
    const abi = isUsdc ? ERC20_ABI : ABIS[name];
    if (!address || !abi) throw new Error(`Unknown or unconfigured contract: ${name}`);
    if (withSigner) {
      if (!signer) throw new Error('Wallet not connected');
      return new ethers.Contract(address, abi, signer);
    }
    const readProvider = provider || new ethers.JsonRpcProvider(targetNetwork.rpcUrls[0]);
    return new ethers.Contract(address, abi, readProvider);
  };

  // Approve `spender` for `amount` on the given ERC-20 (only if the current
  // allowance is short) -- the standard approve-then-act pattern every
  // paid registry action needs.
  const ensureAllowance = async (tokenName, spender, amount) => {
    if (!account) throw new Error('Wallet not connected');
    const token = getContract(tokenName, true);
    const current = await token.allowance(account, spender);
    if (current < amount) {
      const tx = await token.approve(spender, amount);
      await tx.wait();
    }
  };

  const isCorrectNetwork = () => chainId != null && chainId === targetNetwork.chainIdDecimal;
  const formatAddress = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '');

  const value = {
    account,
    provider,
    signer,
    chainId,
    isConnecting,
    isConnected: Boolean(account),
    addresses,
    addressesError,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    getContract,
    ensureAllowance,
    isCorrectNetwork,
    formatAddress,
    targetNetwork,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};
