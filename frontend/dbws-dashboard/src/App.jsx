import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Web3Provider } from './contexts/Web3Context';
import { NotificationProvider } from './contexts/NotificationContext';
import Layout from './components/layout/Layout';
import PortfolioHome from './pages/PortfolioHome';
import PlugRegistryView from './pages/PlugRegistryView';
import EntityRegistryView from './pages/EntityRegistryView';
import IPRegistryView from './pages/IPRegistryView';
import LicenseRegistryView from './pages/LicenseRegistryView';
import CommunityRegistryView from './pages/CommunityRegistryView';
import NoteRegistryView from './pages/NoteRegistryView';

export default function App() {
  return (
    <Web3Provider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<PortfolioHome />} />
              <Route path="/domains" element={<PlugRegistryView />} />
              <Route path="/entities" element={<EntityRegistryView />} />
              <Route path="/ip" element={<IPRegistryView />} />
              <Route path="/licenses" element={<LicenseRegistryView />} />
              <Route path="/community" element={<CommunityRegistryView />} />
              <Route path="/notes" element={<NoteRegistryView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </Web3Provider>
  );
}
