import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/prisma/client';
import { config } from '../../config';
import type { User } from '../../shared/prisma/client';
import type { AuthUser, LoginInput } from './auth.types';

export { AuthUser, LoginInput };

export async function login(input: LoginInput): Promise<{ token: string; user: AuthUser }> {
  const { username, password } = input;
  if (!username?.trim() || !password?.trim()) {
    throw new Error('username and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
    include: { roleRef: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.status !== 'active') {
    throw new Error('Account is not active');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const permissions = user.roleRef?.permissions.map(p => p.permission.key) ?? [];

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    permDataInput: user.permDataInput,
    permDataConfirm: user.permDataConfirm,
    permAdmin: user.permAdmin,
    status: user.status,
    roleId: user.roleId,
    permissions,
  };

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
  );

  return { token, user: authUser };
}

export async function getUserById(id: number): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roleRef: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!user || user.status !== 'active') return null;

  const permissions = user.roleRef?.permissions.map(p => p.permission.key) ?? [];

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    permDataInput: user.permDataInput,
    permDataConfirm: user.permDataConfirm,
    permAdmin: user.permAdmin,
    status: user.status,
    roleId: user.roleId,
    permissions,
  };
}

export function buildAuthUser(user: User, permissions: string[]): AuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    permDataInput: user.permDataInput,
    permDataConfirm: user.permDataConfirm,
    permAdmin: user.permAdmin,
    status: user.status,
    roleId: user.roleId,
    permissions,
  };
}
