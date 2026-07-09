import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useWeb3 } from '../../contexts/Web3Context';
import { useNotification } from '../../contexts/NotificationContext';
import { Shield, Wallet } from 'lucide-react';

const ProtectedRoute = ({
  children,
  requiredRole = 'user',
  requireAuth = true,
  fallback = null
}) => {
  const { isAuthenticated, hasPermission, isLoading, userRole } = useAuth();
  const { connectWallet, isConnecting } = useWeb3();
  const { showError } = useNotification();

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      showError('Connection Failed', error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if authentication is required
  if (requireAuth && !isAuthenticated) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="luxury-card p-8 text-center max-w-md">
          <Wallet size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-serif font-bold mb-2">Authentication Required</h3>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to access this feature.
          </p>
          <button className="luxury-button w-full" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  // Check role permissions
  if (isAuthenticated && !hasPermission(requiredRole)) {
    const getRoleDisplayName = (role) => {
      switch (role) {
        case 'admin': return 'Administrator';
        case 'tld_owner': return 'TLD Owner';
        case 'user': return 'User';
        default: return role;
      }
    };

    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="luxury-card p-8 text-center max-w-md">
          <Shield size={48} className="mx-auto text-red-400 mb-4" />
          <h3 className="text-xl font-serif font-bold mb-2">Access Denied</h3>
          <p className="text-muted-foreground mb-4">
            This feature requires <strong>{getRoleDisplayName(requiredRole)}</strong> privileges.
          </p>
          <p className="text-sm text-muted-foreground">
            Your current role: <strong>{getRoleDisplayName(userRole)}</strong>
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;

