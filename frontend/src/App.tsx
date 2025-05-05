// React import removed as it's not needed with modern JSX transform
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { WizardDashboard } from './pages/WizardDashboard';
import { EndpointDataWrapper } from './components/EndpointDataWrapper';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthCallback } from './pages/AuthCallback';
import { DocumentationPage } from './pages/DocumentationPage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { CookiesPage } from './pages/CookiesPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/dashboard" element={<Navigate to="/wizard" replace />} />
          <Route path="/docs" element={<DocumentationPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route 
            path="/wizard" 
            element={
              <ProtectedRoute>
                <WizardDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/test-data-config" 
            element={
              <ProtectedRoute>
                <EndpointDataWrapper />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;