import '@testing-library/jest-dom';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ accounts: [] }),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;

