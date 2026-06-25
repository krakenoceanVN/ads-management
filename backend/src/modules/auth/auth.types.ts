import type { User } from '../../shared/prisma/client';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  permDataInput: boolean;
  permDataConfirm: boolean;
  permAdmin: boolean;
  status: string;
  roleId: string | null;
  permissions: string[];
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoadedUser {
  user: User;
  permissions: string[];
}