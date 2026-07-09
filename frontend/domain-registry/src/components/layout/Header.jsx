import React, { useState } from 'react';
import { Bell, User, ChevronDown, Wallet, LogOut, Settings, Crown } from 'lucide-react';
import { useWeb3 } from '../../contexts/Web3Context';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../contexts/NotificationContext';

const Header = () => {
  const {
    account,
    balance,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    formatAddress,
    formatBalance,
    network,
    targetNetwork,
    isCorrectNetwork,
    switchNetwork
  } = useWeb3();
  
  const { user, isAuthenticated, userRole } = useAuth();
  const { showError, showSuccess } = useNotification();
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      showSuccess('Wallet Connected', 'Successfully connected to your wallet');
    } catch (error) {
      showError('Connection Failed', error.message);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      showSuccess('Wallet Disconnected', 'Wallet has been disconnected');
    } catch (error) {
      showError('Disconnection Failed', error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await handleDisconnectWallet();
      setShowUserMenu(false);
    } catch (error) {
      showError('Logout Failed', error.message);
    }
  };

  const getRoleDisplay = () => {
    switch (userRole) {
      case 'admin':
        return { label: 'Administrator', icon: Crown, color: 'text-yellow-400' };
      case 'tld_owner':
        return { label: 'TLD Owner', icon: Crown, color: 'text-blue-400' };
      default:
        return { label: 'User', icon: User, color: 'text-gray-400' };
    }
  };

  const roleInfo = getRoleDisplay();
  const RoleIcon = roleInfo.icon;

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Page title or breadcrumb */}
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-serif font-semibold gold-gradient">
            Dashboard
          </h2>
          
          {network && (
            <button
              onClick={() => !isCorrectNetwork() && switchNetwork()}
              className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                isCorrectNetwork() ? 'bg-secondary' : 'bg-yellow-400/10 text-yellow-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${isCorrectNetwork() ? 'status-online' : 'bg-yellow-400'}`}></div>
              <span className="text-sm font-medium">
                {isCorrectNetwork() ? targetNetwork.chainName : `Wrong network — switch to ${targetNetwork.chainName}`}
              </span>
            </button>
          )}
        </div>

        {/* Right side - Actions and user info */}
        <div className="flex items-center gap-4">
          {/* Wallet Connection */}
          {!isConnected ? (
            <button
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="luxury-button flex items-center gap-2"
            >
              <Wallet size={18} />
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg">
              <Wallet size={16} className="text-primary" />
              <div className="text-sm">
                <div className="font-mono font-medium">{formatAddress(account)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBalance(balance)} MATIC
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors relative"
            >
              <Bell size={20} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 luxury-card p-4 z-50">
                <h3 className="font-semibold mb-3">Notifications</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-secondary rounded-lg">
                    <p className="text-sm font-medium">Domain Expiring Soon</p>
                    <p className="text-xs text-muted-foreground">
                      example.plug expires in 7 days
                    </p>
                  </div>
                  <div className="p-3 bg-secondary rounded-lg">
                    <p className="text-sm font-medium">New Offer Received</p>
                    <p className="text-xs text-muted-foreground">
                      5 MATIC offer for test.plug
                    </p>
                  </div>
                </div>
                <button className="w-full mt-3 text-sm text-primary hover:underline">
                  View All Notifications
                </button>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                <User size={16} className="text-primary-foreground" />
              </div>
              
              {isAuthenticated && (
                <div className="text-left">
                  <div className="text-sm font-medium">
                    {user?.displayName || formatAddress(account)}
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${roleInfo.color}`}>
                    <RoleIcon size={12} />
                    {roleInfo.label}
                  </div>
                </div>
              )}
              
              <ChevronDown size={16} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-12 w-64 luxury-card p-2 z-50">
                {isAuthenticated ? (
                  <>
                    <div className="px-3 py-2 border-b border-border mb-2">
                      <p className="font-medium">{user?.displayName || 'User'}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {formatAddress(account)}
                      </p>
                      <div className={`text-xs flex items-center gap-1 mt-1 ${roleInfo.color}`}>
                        <RoleIcon size={12} />
                        {roleInfo.label}
                      </div>
                    </div>
                    
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary rounded-lg transition-colors">
                      <User size={16} />
                      Profile
                    </button>
                    
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary rounded-lg transition-colors">
                      <Settings size={16} />
                      Settings
                    </button>
                    
                    <hr className="my-2 border-border" />
                    
                    <button
                      onClick={handleDisconnectWallet}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Wallet size={16} />
                      Disconnect Wallet
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </>
                ) : (
                  <div className="p-3">
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect your wallet to access all features
                    </p>
                    <button
                      onClick={handleConnectWallet}
                      className="w-full luxury-button"
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

