import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inbounds from './pages/Inbounds';
import Clients from './pages/Clients';
import Nodes from './pages/Nodes';
import NodeDetail from './pages/NodeDetail';
import Logs from './pages/Logs';
import APITokens from './pages/APITokens';
import Settings from './pages/Settings';
import APIDocs from './pages/APIDocs';
import { getAuthToken } from './services/api';
import { SettingsProvider } from './context/SettingsContext';
import './App.css';

// Protected Route Wrapper Component
const ProtectedRoute = ({ children }) => {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <SettingsProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="inbounds" element={<Inbounds />} />
            <Route path="clients" element={<Clients />} />
            <Route path="nodes" element={<Nodes />} />
            <Route path="nodes/:id" element={<NodeDetail />} />
            <Route path="logs" element={<Logs />} />
            <Route path="api-tokens" element={<APITokens />} />
            <Route path="settings" element={<Settings />} />
            <Route path="api-docs" element={<APIDocs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </SettingsProvider>
  );
}

export default App;
