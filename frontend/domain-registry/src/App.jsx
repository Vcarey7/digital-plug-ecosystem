import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Layout Components
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';

// Page Components
import Dashboard from './components/pages/Dashboard';
import DomainPortfolio from './components/pages/DomainPortfolio';
import DomainSearch from './components/pages/DomainSearch';
import BulkRegistration from './components/pages/BulkRegistration';
import Marketplace from './components/pages/Marketplace';
import BrowseDomains from './components/pages/BrowseDomains';
import MyListings from './components/pages/MyListings';
import PurchaseHistory from './components/pages/PurchaseHistory';
import MintingFactory from './components/pages/MintingFactory';
import DomainMinting from './components/pages/DomainMinting';
import AIArtTokens from './components/pages/AIArtTokens';
import AIAgents from './components/pages/AIAgents';
import BulkOperations from './components/pages/BulkOperations';
import TLDManagement from './components/pages/TLDManagement';
import PaymentPortal from './components/pages/PaymentPortal';
import Analytics from './components/pages/Analytics';
import Settings from './components/pages/Settings';

// Context Providers
import { Web3Provider } from './contexts/Web3Context';
import { NotificationProvider } from './contexts/NotificationContext';

// Auth Components
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <NotificationProvider>
      <Web3Provider>
        <Router>
            <div className="min-h-screen bg-background text-foreground">
              <div className="flex">
                {/* Sidebar */}
                <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
                
                {/* Main Content */}
                <div className="flex-1 lg:ml-64">
                  {/* Header */}
                  <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
                  
                  {/* Page Content */}
                  <main className="p-6">
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      
                      {/* Domain Routes - Require Authentication */}
                      <Route 
                        path="/domains" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <DomainPortfolio />
                          </ProtectedRoute>
                        } 
                      />
                      <Route path="/domains/search" element={<DomainSearch />} />
                      <Route 
                        path="/domains/bulk" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <BulkRegistration />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* Marketplace Routes */}
                      <Route path="/marketplace" element={<Marketplace />} />
                      <Route path="/marketplace/browse" element={<BrowseDomains />} />
                      <Route 
                        path="/marketplace/listings" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <MyListings />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/marketplace/history" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <PurchaseHistory />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* Minting Factory Routes - Require Authentication */}
                      <Route 
                        path="/minting" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <MintingFactory />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/minting/domains" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <DomainMinting />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/minting/ai-art" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <AIArtTokens />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/minting/ai-agents" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <AIAgents />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/minting/bulk" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <BulkOperations />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* TLD Management - Require TLD Owner or Admin */}
                      <Route 
                        path="/tld-management" 
                        element={
                          <ProtectedRoute requireAuth={true} requiredRole="tld_owner">
                            <TLDManagement />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* Payment Portal - Require Authentication */}
                      <Route 
                        path="/payments" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <PaymentPortal />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* Analytics - Require Admin */}
                      <Route 
                        path="/analytics" 
                        element={
                          <ProtectedRoute requireAuth={true} requiredRole="admin">
                            <Analytics />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* Settings - Require Authentication */}
                      <Route 
                        path="/settings" 
                        element={
                          <ProtectedRoute requireAuth={true}>
                            <Settings />
                          </ProtectedRoute>
                        } 
                      />
                    </Routes>
                  </main>
                </div>
              </div>
            </div>
        </Router>
      </Web3Provider>
    </NotificationProvider>
  );
}

export default App;

