import { render, screen, fireEvent } from '@testing-library/react';
import { MetricsPanel } from '../MetricsPanel';
import { vi } from 'vitest';

describe('MetricsPanel', () => {
  const defaultProps = {
    testId: 'test-123',
    totalRequests: 1000,
    activeEndpoints: 3,
    peakConcurrent: 50
  };

  it('renders summary statistics correctly', () => {
    render(<MetricsPanel {...defaultProps} />);
    
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders all metric tabs', () => {
    render(<MetricsPanel {...defaultProps} />);
    
    expect(screen.getByText('Avg Response')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Min Response')).toBeInTheDocument();
    expect(screen.getByText('Max Response')).toBeInTheDocument();
  });

  it('switches between metrics views when clicking tabs', () => {
    render(<MetricsPanel {...defaultProps} />);
    
    // Initially shows Average Response Time
    expect(screen.getByText('Average Response Time vs Concurrent Requests')).toBeInTheDocument();
    
    // Click Success Rate tab
    fireEvent.click(screen.getByText('Success Rate'));
    expect(screen.getByText('Success Rate vs Concurrent Requests')).toBeInTheDocument();
    
    // Click Min Response tab
    fireEvent.click(screen.getByText('Min Response'));
    expect(screen.getByText('Minimum Response Time vs Concurrent Requests')).toBeInTheDocument();
    
    // Click Max Response tab
    fireEvent.click(screen.getByText('Max Response'));
    expect(screen.getByText('Maximum Response Time vs Concurrent Requests')).toBeInTheDocument();
  });

  it('updates summary statistics when props change', () => {
    const { rerender } = render(<MetricsPanel {...defaultProps} />);
    
    expect(screen.getByText('1,000')).toBeInTheDocument();
    
    // Update props
    rerender(<MetricsPanel {...defaultProps} totalRequests={2000} activeEndpoints={5} />);
    
    expect(screen.getByText('2,000')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
