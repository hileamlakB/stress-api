import { render, screen, fireEvent, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import '@testing-library/jest-dom';

// Mock the required components and services
jest.mock('../components/MetricsPanel', () => ({
  MetricsPanel: () => <div data-testid="metrics-panel">Metrics Panel</div>
}));

jest.mock('../components/DemoMetricsPanel', () => ({
  DemoMetricsPanel: () => <div data-testid="demo-metrics-panel">Demo Metrics Panel</div>
}));

jest.mock('../components/SessionSidebar', () => ({
  SessionSidebar: () => <div data-testid="session-sidebar">Session Sidebar</div>
}));

jest.mock('../components/endpoints/EndpointsList', () => ({
  EndpointsList: () => <div data-testid="endpoints-list">Endpoints List</div>
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock as any;

describe('Dark Mode Implementation', () => {
  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('should apply dark mode classes to all major components when dark mode is enabled', async () => {
    renderDashboard();
    
    // Find and click the dark mode toggle
    const darkModeToggle = screen.getByRole('button', { name: /toggle dark mode/i });
    fireEvent.click(darkModeToggle);

    // Check if html element has dark class
    expect(document.documentElement).toHaveClass('dark');

    // Main container should have dark mode classes
    const mainContainer = screen.getByTestId('dashboard-container');
    expect(mainContainer).toHaveClass('dark:bg-gray-900');

    // Check critical components for dark mode classes
    const criticalComponents = [
      { id: 'session-sidebar', classes: ['dark:bg-gray-800', 'dark:text-gray-100'] },
      { id: 'metrics-panel', classes: ['dark:bg-gray-800'] },
      { id: 'api-config-section', classes: ['dark:bg-gray-800', 'dark:border-gray-700'] },
      { id: 'endpoints-section', classes: ['dark:bg-gray-800'] }
    ];

    criticalComponents.forEach(component => {
      const element = screen.getByTestId(component.id);
      component.classes.forEach(className => {
        expect(element).toHaveClass(className);
      });
    });

    // Check form elements
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toHaveClass('dark:bg-gray-800', 'dark:border-gray-700');
    });

    // Check buttons
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toHaveClass('dark:text-gray-100');
    });
  });

  test('should persist dark mode preference in localStorage', () => {
    renderDashboard();
    
    const darkModeToggle = screen.getByRole('button', { name: /toggle dark mode/i });
    fireEvent.click(darkModeToggle);

    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  test('should load dark mode preference from localStorage on mount', () => {
    localStorage.getItem.mockReturnValue('dark');
    renderDashboard();

    expect(document.documentElement).toHaveClass('dark');
  });

  test('should properly toggle between light and dark modes', () => {
    renderDashboard();
    
    const darkModeToggle = screen.getByRole('button', { name: /toggle dark mode/i });
    
    // Toggle to dark mode
    fireEvent.click(darkModeToggle);
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.setItem).toHaveBeenLastCalledWith('theme', 'dark');

    // Toggle back to light mode
    fireEvent.click(darkModeToggle);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.setItem).toHaveBeenLastCalledWith('theme', 'light');
  });

  test('should apply dark mode to dynamic content', async () => {
    renderDashboard();
    
    // Enable dark mode
    const darkModeToggle = screen.getByRole('button', { name: /toggle dark mode/i });
    fireEvent.click(darkModeToggle);

    // Check visualization elements
    const visualizationElements = screen.getAllByTestId(/visualization/);
    visualizationElements.forEach(element => {
      expect(element).toHaveClass('dark:bg-gray-800');
    });

    // Check session list items
    const sessionItems = screen.getAllByTestId(/session-item/);
    sessionItems.forEach(item => {
      expect(item).toHaveClass('dark:bg-gray-800', 'dark:text-gray-100');
    });

    // Check API input area
    const apiInput = screen.getByTestId('api-input');
    expect(apiInput).toHaveClass('dark:bg-gray-800', 'dark:border-gray-700');
  });

  test('should maintain dark mode styles after component updates', async () => {
    renderDashboard();
    
    // Enable dark mode
    const darkModeToggle = screen.getByRole('button', { name: /toggle dark mode/i });
    fireEvent.click(darkModeToggle);

    // Trigger a component update (e.g., by changing a filter)
    const filterInput = screen.getByPlaceholderText(/filter endpoints/i);
    fireEvent.change(filterInput, { target: { value: 'test' } });

    // Verify dark mode classes are maintained
    const mainContainer = screen.getByTestId('dashboard-container');
    expect(mainContainer).toHaveClass('dark:bg-gray-900');
    
    const sessionSidebar = screen.getByTestId('session-sidebar');
    expect(sessionSidebar).toHaveClass('dark:bg-gray-800');
  });
});
