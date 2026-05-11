import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from '@/components/Card';
import { FilterPanel } from '@/components/FilterPanel';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { ThemeProvider } from '@/context/ThemeContext';

jest.mock('@/components/AccountSwitcher', () => ({
  AccountSwitcher: () => <div data-testid="account-switcher" />,
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('UI Components', () => {
  describe('Card Component', () => {
    it('renders children correctly', () => {
      render(<Card>Test Content</Card>);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders title and value', () => {
      render(<Card title="Total Cost" value="$1000" />);
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
      expect(screen.getByText('$1000')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-class">Content</Card>);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('FilterPanel Component', () => {
    it('renders all options correctly', () => {
      render(<FilterPanel onFilterChange={() => {}} campaigns={['Camp1']} />);
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      expect(screen.getByText('Camp1')).toBeInTheDocument();
    });

    it('calls onFilterChange when apply is clicked', () => {
      const mockFn = jest.fn();
      render(<FilterPanel onFilterChange={mockFn} />);
      
      fireEvent.click(screen.getByText('Apply Filters'));
      expect(mockFn).toHaveBeenCalledWith({ period: '7d', campaign: 'all', startDate: '', endDate: '' });
    });

    it('changes values when selected', () => {
      const mockFn = jest.fn();
      render(<FilterPanel onFilterChange={mockFn} />);
      
      fireEvent.change(screen.getByDisplayValue('Last 7 days'), { target: { value: '30d' } });
      fireEvent.click(screen.getByText('Apply Filters'));
      
      expect(mockFn).toHaveBeenCalledWith({ period: '30d', campaign: 'all', startDate: '', endDate: '' });
    });

    it('calls onRefresh when refresh is clicked', () => {
      const mockRefresh = jest.fn();
      render(<FilterPanel onFilterChange={() => {}} onRefresh={mockRefresh} />);

      fireEvent.click(screen.getByText('Refresh'));

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navbar & Sidebar Components', () => {
    const renderWithProviders = (ui: React.ReactElement) => 
      render(
        <ThemeProvider>
          {ui}
        </ThemeProvider>
      );

    it('renders Navbar correctly', () => {
      renderWithProviders(<Navbar />);
      expect(screen.getByText('SocialView')).toBeInTheDocument();
    });

    it('renders Sidebar correctly', () => {
      renderWithProviders(<Sidebar />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    
    it('contains valid links in Navbar', () => {
      renderWithProviders(<Navbar />);
      const settingsLink = screen.getByRole('link', { name: /SocialView/i });
      expect(settingsLink).toHaveAttribute('href', '/');
    });
  });
});
