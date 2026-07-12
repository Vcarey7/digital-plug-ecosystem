import { useState, useEffect } from 'react';
import { useWeb3 } from '../contexts/Web3Context';

// Wallet-native auth: "signed in" simply means a wallet is connected on the
// right network -- every write call already requires a wallet signature per
// transaction, so a separate sign-in step adds friction without adding real
// security here. Role is read directly from PlugRegistry's on-chain
// AccessControl roles rather than a mocked/off-chain user table, since
// there's no backend in this build to source it from.
export const useAuth = () => {
  const { account, isConnected, getContract, isContractConfigured } = useWeb3();
  const [userRole, setUserRole] = useState('user');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolveRole = async () => {
      setIsLoading(true);

      if (!isConnected || !account || !isContractConfigured('plugRegistry')) {
        if (!cancelled) {
          setUserRole('user');
          setIsLoading(false);
        }
        return;
      }

      try {
        const registry = getContract('plugRegistry');
        const [adminRole, registrarRole] = await Promise.all([
          registry.DEFAULT_ADMIN_ROLE(),
          registry.REGISTRAR_ROLE(),
        ]);
        const [isAdmin, isRegistrar] = await Promise.all([
          registry.hasRole(adminRole, account),
          registry.hasRole(registrarRole, account),
        ]);

        if (cancelled) return;

        if (isAdmin) {
          setUserRole('admin');
        } else if (isRegistrar) {
          setUserRole('registrar');
        } else {
          setUserRole('user');
        }
      } catch (error) {
        console.error('Failed to resolve on-chain role:', error);
        if (!cancelled) setUserRole('user');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    resolveRole();
    return () => {
      cancelled = true;
    };
  }, [account, isConnected, getContract, isContractConfigured]);

  const hasPermission = (requiredRole) => {
    const roleHierarchy = { user: 0, registrar: 1, admin: 2 };
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  };

  return {
    user: isConnected ? { address: account } : null,
    userRole,
    isLoading,
    isAuthenticated: Boolean(isConnected && account),
    isAdmin: userRole === 'admin',
    isRegistrar: userRole === 'registrar' || userRole === 'admin',
    hasPermission,
  };
};
