import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  Search,
  Grid,
  List,
  RefreshCw,
  Plus,
  Clock,
  Globe,
  Eye
} from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useNotification } from '../../contexts/NotificationContext';

const RENEW_DURATION = 365 * 24 * 60 * 60; // 1 year

const DomainPortfolio = () => {
  const { account, getContract, isContractConfigured } = useWeb3();
  const { showError, showSuccess } = useNotification();

  const [domains, setDomains] = useState([]);
  const [filteredDomains, setFilteredDomains] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'expiring', 'expired'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'expiry'
  const [renewingId, setRenewingId] = useState(null);

  const getStatus = (domain) => {
    if (domain.isTLD) return 'active';
    const daysLeft = Math.ceil((domain.expires - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'expired';
    if (daysLeft < 30) return 'expiring';
    return 'active';
  };

  const fetchDomains = useCallback(async () => {
    if (!account || !isContractConfigured('domainRegistry')) {
      setDomains([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const registry = getContract('domainRegistry');
      const hashes = await registry.getOwnerDomains(account);

      const resolved = await Promise.all(
        hashes.map(async (hash) => {
          const info = await registry.getDomain(hash);
          return {
            hash,
            name: info.name,
            tokenId: info.tokenId.toString(),
            owner: info.owner,
            resolver: info.resolver,
            expires: new Date(Number(info.expiry) * 1000),
            isTLD: info.isTLD,
            parentHash: info.parentHash,
          };
        })
      );

      // Skip TLDs the account owns -- this view is for registered domains,
      // not the TLDs themselves.
      setDomains(resolved.filter((d) => !d.isTLD));
    } catch (error) {
      showError('Failed to Load Domains', error.reason || error.message);
    } finally {
      setIsLoading(false);
    }
  }, [account, getContract, isContractConfigured, showError]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    let filtered = domains;

    if (searchTerm) {
      filtered = filtered.filter((domain) => domain.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((domain) => getStatus(domain) === filterStatus);
    }

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'expiry') return a.expires - b.expires;
      return a.name.localeCompare(b.name);
    });

    setFilteredDomains(filtered);
  }, [domains, searchTerm, filterStatus, sortBy]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-400/10';
      case 'expiring':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'expired':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getDaysUntilExpiry = (expiryDate) => {
    const diffTime = expiryDate - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleRenewDomain = async (domain) => {
    setRenewingId(domain.tokenId);
    try {
      const registry = getContract('domainRegistry', true);
      const cost = await registry.baseDomainPrice();
      const tx = await registry.renewDomain(domain.hash, RENEW_DURATION, { value: cost });
      await tx.wait();
      showSuccess('Domain Renewed', `${domain.name} has been renewed for 1 year`);
      await fetchDomains();
    } catch (error) {
      showError('Renewal Failed', error.reason || error.shortMessage || error.message);
    } finally {
      setRenewingId(null);
    }
  };

  const DomainCard = ({ domain }) => {
    const daysLeft = getDaysUntilExpiry(domain.expires);
    const status = getStatus(domain);
    const statusColor = getStatusColor(status);
    const isRenewing = renewingId === domain.tokenId;

    return (
      <div className="luxury-card p-6 hover:scale-105 transition-transform">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe size={20} className="text-primary" />
            <h3 className="font-mono font-bold text-lg">{domain.name}</h3>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>{status}</div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Token ID</span>
            <span className="font-mono">#{domain.tokenId}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Expires</span>
            <span className={daysLeft < 30 ? 'text-yellow-400' : ''}>
              {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Resolver</span>
            <span className="font-mono text-xs">
              {domain.resolver === ethers.ZeroAddress ? 'Not set' : `${domain.resolver.slice(0, 6)}...${domain.resolver.slice(-4)}`}
            </span>
          </div>
        </div>

        <button
          onClick={() => handleRenewDomain(domain)}
          disabled={isRenewing}
          className="w-full flex items-center justify-center gap-2 luxury-button text-sm disabled:opacity-60"
        >
          <Clock size={14} />
          {isRenewing ? 'Renewing...' : 'Renew 1 Year'}
        </button>
      </div>
    );
  };

  const DomainRow = ({ domain }) => {
    const daysLeft = getDaysUntilExpiry(domain.expires);
    const status = getStatus(domain);
    const statusColor = getStatusColor(status);
    const isRenewing = renewingId === domain.tokenId;

    return (
      <tr className="border-b border-border hover:bg-secondary/50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-primary" />
            <span className="font-mono font-medium">{domain.name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>{status}</div>
        </td>
        <td className="px-4 py-3 text-sm">{daysLeft > 0 ? `${daysLeft} days` : 'Expired'}</td>
        <td className="px-4 py-3 text-sm font-mono">#{domain.tokenId}</td>
        <td className="px-4 py-3">
          <button
            onClick={() => handleRenewDomain(domain)}
            disabled={isRenewing}
            className="p-1 hover:bg-secondary rounded text-xs px-2"
          >
            {isRenewing ? '...' : 'Renew'}
          </button>
        </td>
      </tr>
    );
  };

  if (!account) {
    return (
      <div className="luxury-card p-12 text-center">
        <Globe size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Connect your wallet</h3>
        <p className="text-muted-foreground">Connect a wallet to see your domain portfolio.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-serif font-bold gold-gradient">Domain Portfolio</h1>
          <RefreshCw className="animate-spin" size={20} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="luxury-card p-6 loading-pulse">
              <div className="h-32 bg-secondary rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold gold-gradient">Domain Portfolio</h1>
          <p className="text-muted-foreground">Managing {domains.length} registered domains</p>
        </div>

        <a href="/domains/search" className="luxury-button flex items-center gap-2">
          <Plus size={18} />
          Register Domain
        </a>
      </div>

      <div className="luxury-card p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search domains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2"
          >
            <option value="name">Sort by Name</option>
            <option value="expiry">Sort by Expiry</option>
          </select>

          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {filteredDomains.length === 0 ? (
        <div className="luxury-card p-12 text-center">
          <Globe size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No domains found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'Start building your domain portfolio'}
          </p>
          <a href="/domains/search" className="luxury-button inline-flex items-center gap-2">
            <Eye size={16} />
            Register Your First Domain
          </a>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDomains.map((domain) => (
            <DomainCard key={domain.tokenId} domain={domain} />
          ))}
        </div>
      ) : (
        <div className="luxury-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Domain</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Expires</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Token ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDomains.map((domain) => (
                <DomainRow key={domain.tokenId} domain={domain} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DomainPortfolio;
