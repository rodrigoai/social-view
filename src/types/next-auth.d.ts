import type { UserRole, UserStatus } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
      sessionVersion: number;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
    status: UserStatus;
    sessionVersion: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    status?: UserStatus;
    sessionVersion?: number;
  }
}
