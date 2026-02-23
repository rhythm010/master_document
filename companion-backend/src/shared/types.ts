import { AdminRole } from '@prisma/client';

export type AuthRole = 'CLIENT' | 'COMPANION' | AdminRole;

export type AuthUser = {
  id: string;
  role: AuthRole;
};
