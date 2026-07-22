import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('public pages', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('links to both legal pages and displays the Coyô attribution on login', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByLabelText('Powered by Coyô')).toBeInTheDocument();
    expect(screen.getByAltText('Coyô')).toHaveAttribute('src', expect.stringContaining('coyo-logo.png'));
  });

  it('renders the Terms of Service as a public document', () => {
    render(<TermsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4. Acceptable use' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('renders the Privacy Policy as a public document', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '8. Your privacy rights' })).toBeInTheDocument();
    expect(screen.getByText(/We do not sell personal information\./)).toBeInTheDocument();
  });
});
