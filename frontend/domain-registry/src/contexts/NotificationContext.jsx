import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  // Add notification
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info', // 'success', 'error', 'warning', 'info'
      title: '',
      message: '',
      duration: 5000, // Auto-dismiss after 5 seconds
      persistent: false, // If true, won't auto-dismiss
      ...notification
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-dismiss if not persistent
    if (!newNotification.persistent && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods for different notification types
  const showSuccess = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'success',
      title,
      message,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'error',
      title,
      message,
      persistent: true, // Errors should be persistent by default
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'warning',
      title,
      message,
      duration: 8000, // Warnings stay longer
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'info',
      title,
      message,
      ...options
    });
  }, [addNotification]);

  // Transaction-specific notifications
  const showTransactionPending = useCallback((txHash, message = 'Transaction submitted') => {
    return addNotification({
      type: 'info',
      title: 'Transaction Pending',
      message: `${message}. Hash: ${txHash.slice(0, 10)}...`,
      persistent: true,
      action: {
        label: 'View on Explorer',
        onClick: () => window.open(`https://polygonscan.com/tx/${txHash}`, '_blank')
      }
    });
  }, [addNotification]);

  const showTransactionSuccess = useCallback((txHash, message = 'Transaction confirmed') => {
    return addNotification({
      type: 'success',
      title: 'Transaction Successful',
      message: `${message}. Hash: ${txHash.slice(0, 10)}...`,
      duration: 10000,
      action: {
        label: 'View on Explorer',
        onClick: () => window.open(`https://polygonscan.com/tx/${txHash}`, '_blank')
      }
    });
  }, [addNotification]);

  const showTransactionError = useCallback((error, message = 'Transaction failed') => {
    return addNotification({
      type: 'error',
      title: 'Transaction Failed',
      message: `${message}. ${error.message || error}`,
      persistent: true
    });
  }, [addNotification]);

  // Domain-specific notifications
  const showDomainRegistered = useCallback((domainName, txHash) => {
    return addNotification({
      type: 'success',
      title: 'Domain Registered!',
      message: `Successfully registered ${domainName}`,
      duration: 10000,
      action: {
        label: 'View Transaction',
        onClick: () => window.open(`https://polygonscan.com/tx/${txHash}`, '_blank')
      }
    });
  }, [addNotification]);

  const showDomainTransferred = useCallback((domainName, toAddress) => {
    return addNotification({
      type: 'success',
      title: 'Domain Transferred',
      message: `${domainName} transferred to ${toAddress.slice(0, 10)}...`,
      duration: 8000
    });
  }, [addNotification]);

  const showDomainExpiring = useCallback((domainName, daysLeft) => {
    return addNotification({
      type: 'warning',
      title: 'Domain Expiring Soon',
      message: `${domainName} expires in ${daysLeft} days`,
      persistent: true,
      action: {
        label: 'Renew Now',
        onClick: () => {
          // Navigate to renewal page
          window.location.href = `/portfolio/domains?renew=${domainName}`;
        }
      }
    });
  }, [addNotification]);

  // Marketplace notifications
  const showOfferReceived = useCallback((domainName, offerAmount) => {
    return addNotification({
      type: 'info',
      title: 'New Offer Received',
      message: `${offerAmount} MATIC offer for ${domainName}`,
      persistent: true,
      action: {
        label: 'View Offers',
        onClick: () => {
          window.location.href = '/marketplace/listings';
        }
      }
    });
  }, [addNotification]);

  const showDomainSold = useCallback((domainName, salePrice) => {
    return addNotification({
      type: 'success',
      title: 'Domain Sold!',
      message: `${domainName} sold for ${salePrice} MATIC`,
      duration: 10000
    });
  }, [addNotification]);

  // System notifications
  const showMaintenanceMode = useCallback(() => {
    return addNotification({
      type: 'warning',
      title: 'Maintenance Mode',
      message: 'Some features may be temporarily unavailable',
      persistent: true
    });
  }, [addNotification]);

  const showNetworkError = useCallback(() => {
    return addNotification({
      type: 'error',
      title: 'Network Error',
      message: 'Please check your internet connection and try again',
      persistent: true
    });
  }, [addNotification]);

  const showWalletConnectionRequired = useCallback(() => {
    return addNotification({
      type: 'warning',
      title: 'Wallet Required',
      message: 'Please connect your wallet to continue',
      persistent: true,
      action: {
        label: 'Connect Wallet',
        onClick: () => {
          // Trigger wallet connection
          window.dispatchEvent(new CustomEvent('connectWallet'));
        }
      }
    });
  }, [addNotification]);

  const value = {
    // State
    notifications,
    
    // Basic actions
    addNotification,
    removeNotification,
    clearNotifications,
    
    // Convenience methods
    showSuccess,
    showError,
    showWarning,
    showInfo,
    
    // Transaction notifications
    showTransactionPending,
    showTransactionSuccess,
    showTransactionError,
    
    // Domain notifications
    showDomainRegistered,
    showDomainTransferred,
    showDomainExpiring,
    
    // Marketplace notifications
    showOfferReceived,
    showDomainSold,
    
    // System notifications
    showMaintenanceMode,
    showNetworkError,
    showWalletConnectionRequired
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

