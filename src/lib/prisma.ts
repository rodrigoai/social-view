import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function assertSafeTestDatabase() {
  const isTestRuntime = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  if (!isTestRuntime || process.env.ALLOW_NON_TEST_DATABASE_IN_TESTS === 'true') return;

  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) return;

  const isExplicitTestDatabase = /(^file:.*test|[?&]schema=test(?:&|$)|(^|[_./:-])test([_./:-]|$))/i.test(databaseUrl);
  if (!isExplicitTestDatabase) {
    throw new Error(
      'Refusing to initialize Prisma during tests with a non-test DATABASE_URL. ' +
      'Use a test database URL or mock @/lib/prisma.',
    );
  }
}

assertSafeTestDatabase();

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
