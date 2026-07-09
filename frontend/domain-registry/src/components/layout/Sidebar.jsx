import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../../contexts/Web3Context';
import { 
  BarChart3, 
  Wallet, 
  Search, 
  ShoppingCart, 
  Factory, 
  Settings, 
  Crown, 
  CreditCard,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Bot,
  Layers,
  Globe,
  Package,
  History,
  List,
  Zap
} from 'lucide-react';

const Sidebar = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { isConnected, isCorrectNetwork, targetNetwork } = useWeb3();
  const [expandedSections, setExpandedSections] = useState({
    portfolio: true,
    marketplace: false,
    minting: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      path: '/dashboard',
      type: 'single'
    },
    {
      id: 'portfolio',
      label: 'Domain Portfolio',
      icon: Wallet,
      type: 'section',
      expanded: expandedSections.portfolio,
      children: [
        { label: 'My Domains', icon: Globe, path: '/portfolio/domains' },
        { label: 'Domain Search', icon: Search, path: '/portfolio/search' },
        { label: 'Bulk Registration', icon: Package, path: '/portfolio/bulk' }
      ]
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      icon: ShoppingCart,
      type: 'section',
      expanded: expandedSections.marketplace,
      children: [
        { label: 'Browse Domains', icon: Search, path: '/marketplace/browse' },
        { label: 'My Listings', icon: List, path: '/marketplace/listings' },
        { label: 'Purchase History', icon: History, path: '/marketplace/history' }
      ]
    },
    {
      id: 'minting',
      label: 'Minting Factory',
      icon: Factory,
      type: 'section',
      expanded: expandedSections.minting,
      children: [
        { label: 'Domain Minting', icon: Globe, path: '/minting/domains' },
        { label: 'AI Art Tokens', icon: Sparkles, path: '/minting/ai-art' },
        { label: 'AI Agents', icon: Bot, path: '/minting/ai-agents' },
        { label: 'Bulk Operations', icon: Layers, path: '/minting/bulk' }
      ]
    },
    {
      id: 'tld',
      label: 'TLD Management',
      icon: Crown,
      path: '/tld-management',
      type: 'single',
      adminOnly: true
    },
    {
      id: 'payments',
      label: 'Payment Portal',
      icon: CreditCard,
      path: '/payments',
      type: 'single'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      path: '/analytics',
      type: 'single',
      adminOnly: true
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      type: 'single'
    }
  ];

  const SidebarItem = ({ item, isChild = false }) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    if (item.type === 'section') {
      return (
        <div className="mb-2">
          <button
            onClick={() => toggleSection(item.id)}
            className={`sidebar-item w-full justify-between ${
              collapsed ? 'px-2' : 'px-4'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon size={20} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </div>
            {!collapsed && (
              item.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            )}
          </button>
          
          {!collapsed && item.expanded && (
            <div className="ml-4 mt-2 space-y-1">
              {item.children.map((child, index) => (
                <SidebarItem key={index} item={child} isChild={true} />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        to={item.path}
        className={`sidebar-item ${active ? 'active' : ''} ${
          isChild ? 'ml-4 py-2' : 'mb-2'
        } ${collapsed ? 'px-2 justify-center' : 'px-4'}`}
        title={collapsed ? item.label : ''}
      >
        <Icon size={20} />
        {!collapsed && <span className="font-medium">{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {!collapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
        ${collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between p-4 border-b border-sidebar-border
          ${collapsed ? 'px-2' : 'px-4'}
        `}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Zap size={20} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-serif font-bold text-lg gold-gradient">
                  Web3 Registry
                </h1>
                <p className="text-xs text-muted-foreground">.plug TLD Platform</p>
              </div>
            </div>
          )}
          
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => (
            <SidebarItem key={item.id} item={item} />
          ))}
        </nav>

        {/* Footer */}
        <div className={`
          p-4 border-t border-sidebar-border
          ${collapsed ? 'px-2' : 'px-4'}
        `}>
          {!collapsed && (
            <div className="luxury-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${isConnected && isCorrectNetwork() ? 'status-online' : 'bg-yellow-400'}`}></div>
                <span className="text-sm font-medium">{targetNetwork.chainName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {!isConnected ? 'Wallet not connected' : isCorrectNetwork() ? 'Connected' : 'Wrong network'}
              </p>
            </div>
          )}

          {collapsed && (
            <div className="flex justify-center">
              <div className={`w-2 h-2 rounded-full ${isConnected && isCorrectNetwork() ? 'status-online' : 'bg-yellow-400'}`}></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;

