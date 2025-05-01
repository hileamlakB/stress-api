import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LandingPage } from '../pages/LandingPage';
import { WizardDashboard } from '../pages/WizardDashboard';
import * as authModule from '../lib/auth';

// Mock the auth module
vi.mock('../lib/auth', () => ({
  getCurrentUser: vi.fn(),
  signOut: vi.fn()
}));

// Mock the react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Authentication Redirect Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect unauthenticated users to login when accessing WizardDashboard directly', async () => {
    // Mock getCurrentUser to return null (unauthenticated)
    vi.mocked(authModule.getCurrentUser).mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/wizard']}>
        <WizardDashboard />
      </MemoryRouter>
    );

    // Wait for the useEffect to run and check if navigate was called with '/login'
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('should redirect to login when clicking Try Step Wizard button while unauthenticated', async () => {
    // This test detects the bug where clicking the button doesn't check authentication
    
    // Render the landing page with the button
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    // Find the "Try Step Wizard" button
    const wizardButton = screen.getByText('Try Step Wizard');
    expect(wizardButton).toBeInTheDocument();

    // Click the button - in the current implementation, this would navigate directly to /wizard
    // without checking authentication
    fireEvent.click(wizardButton);

    // In a fixed implementation, the button would either:
    // 1. Check authentication status before navigating, or
    // 2. The route would be protected at the router level
    
    // This assertion will fail with the current implementation, correctly identifying the bug
    // In a fixed implementation, we would expect to be redirected to login
    expect(window.location.pathname).toBe('/login');
  });
});
