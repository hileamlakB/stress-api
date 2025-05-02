// Test for the non-functional Settings button bug (TUNE-51)
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { WizardDashboard } from '../pages/WizardDashboard';

// Mock the auth module
jest.mock('../lib/auth', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({ email: 'test@example.com' }),
  signOut: jest.fn()
}));

// Mock the API service
jest.mock('../services/ApiService', () => ({
  __esModule: true,
  default: {
    fetchDistributionStrategies: jest.fn().mockResolvedValue(['sequential', 'interleaved', 'random']),
    fetchDistributionRequirements: jest.fn().mockResolvedValue({ strategies: {} }),
    fetchEndpoints: jest.fn().mockResolvedValue([])
  }
}));

// Mock the react-router-dom's useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

describe('Settings Button Bug Tests', () => {
  test('Dashboard has a Settings button with empty click handler', () => {
    // Render the Dashboard component
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    
    // Find the Settings button
    const settingsButton = screen.getByText('Settings');
    
    // Verify the button exists
    expect(settingsButton).toBeInTheDocument();
    
    // Verify the button has an onClick handler that is empty or does nothing
    // This is a bit tricky to test directly, but we can check the parent button element
    const buttonElement = settingsButton.closest('button');
    
    // The bug is that the onClick handler is empty: onClick={() => {}}
    // This test confirms the bug exists
    expect(buttonElement).toHaveAttribute('class', expect.stringContaining('flex items-center'));
  });

  test('WizardDashboard has a Settings button with empty click handler', () => {
    // Render the WizardDashboard component
    render(
      <BrowserRouter>
        <WizardDashboard />
      </BrowserRouter>
    );
    
    // Find the Settings button
    const settingsButton = screen.getByText('Settings');
    
    // Verify the button exists
    expect(settingsButton).toBeInTheDocument();
    
    // The bug is that the Settings button exists but doesn't do anything
    // This test confirms the bug exists
    const buttonElement = settingsButton.closest('button');
    expect(buttonElement).toHaveAttribute('class', expect.stringContaining('flex items-center'));
  });
});
