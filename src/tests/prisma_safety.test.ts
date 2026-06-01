/**
 * @jest-environment node
 */

describe('Prisma test safety', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.resetModules();
    process.env = originalEnv;
  });

  it('refuses to initialize a real Prisma client against a non-test database during tests', () => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JEST_WORKER_ID: '1',
      DATABASE_URL: 'postgres://user:password@db.prisma.io:5432/postgres?sslmode=require',
      ALLOW_NON_TEST_DATABASE_IN_TESTS: undefined,
    };

    expect(() => {
      jest.isolateModules(() => {
        require('@/lib/prisma');
      });
    }).toThrow('Refusing to initialize Prisma during tests with a non-test DATABASE_URL');
  });
});
