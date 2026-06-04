import type { User } from '../../shared/prisma/client';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  // Legacy permission flags — preserved per schema requirements
  permDataInput: boolean;
  permDataConfirm: boolean;
  permAdmin: boolean;
  status: string;
  // RBAC fields — nullable per schema
  roleId: number | null;
  // Permissions resolved from RBAC roleRef; empty array if roleId is null
  permissions: string[];
}

export interface LoginInput {
  username: string;
  password: string;
}

// Load user from DB for auth purposes
export interface LoadedUser {
  user: User;
  permissions: string[];
}
