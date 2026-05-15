import '@testing-library/jest-dom';

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: jest.fn(() => ({
    status: 'authenticated',
    data: {
      user: {
        id: 'test-admin',
        email: 'admin@example.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        sessionVersion: 1,
      },
    },
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ accounts: [] }),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;
