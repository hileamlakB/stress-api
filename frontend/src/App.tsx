import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WizardDashboard } from './pages/WizardDashboard';
import { EndpointDataWrapper } from './components/EndpointDataWrapper';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<Navigate to="/wizard" replace />} />
          <Route path="/wizard" element={<WizardDashboard />} />
          <Route path="/test-data-config" element={<EndpointDataWrapper />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;