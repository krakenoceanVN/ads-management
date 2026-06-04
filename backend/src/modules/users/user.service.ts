import bcrypt from 'bcrypt';
import { prisma } from '../../shared/prisma/client';
import type { User } from '../../shared/prisma/client';

export interface CreateUserInput {
  username: string;
  password: string;
  role?: string;
  permDataInput?: boolean;
  permDataConfirm?: boolean;
  permAdmin?: boolean;
  status?: string;
  roleId?: number | null;
}

export interface UpdateUserInput {
  username?: string;
  role?: string;
  permDataInput?: boolean;
  permDataConfirm?: boolean;
  permAdmin?: boolean;
  status?: string;
  roleId?: number | null;
  // Explicit password change — must be explicitly provided
  password?: string;
}

export interface ResetPasswordInput {
  password: string;
}

export interface UserResponse {
  id: number;
  username: string;
  role: string;
  permDataInput: boolean;
  permDataConfirm: boolean;
  permAdmin: boolean;
  status: string;
  roleId: number | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    permDataInput: user.permDataInput,
    permDataConfirm: user.permDataConfirm,
    permAdmin: user.permAdmin,
    status: user.status,
    roleId: user.roleId,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
  });
  return users.map(toUserResponse);
}

export async function createUser(input: CreateUserInput) {
  const { username, password, ...rest } = input;
  if (!username?.trim()) throw new Error('username is required');
  if (!password?.trim()) throw new Error('password is required');
  if (password.length < 6) throw new Error('password must be at least 6 characters');

  const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (existing) throw new Error('Username already exists');

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username: username.trim(),
      passwordHash,
      role: rest.role ?? 'EDITOR',
      permDataInput: rest.permDataInput ?? false,
      permDataConfirm: rest.permDataConfirm ?? false,
      permAdmin: rest.permAdmin ?? false,
      status: rest.status ?? 'active',
      roleId: rest.roleId ?? null,
    },
  });

  return toUserResponse(user);
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const { password, ...rest } = input;

  const updateData: Record<string, unknown> = {};

  if (rest.username !== undefined) updateData['username'] = rest.username.trim();
  if (rest.role !== undefined) updateData['role'] = rest.role;
  if (rest.permDataInput !== undefined) updateData['permDataInput'] = rest.permDataInput;
  if (rest.permDataConfirm !== undefined) updateData['permDataConfirm'] = rest.permDataConfirm;
  if (rest.permAdmin !== undefined) updateData['permAdmin'] = rest.permAdmin;
  if (rest.status !== undefined) updateData['status'] = rest.status;
  if (rest.roleId !== undefined) updateData['roleId'] = rest.roleId;

  if (password !== undefined) {
    if (!password?.trim()) throw new Error('password cannot be empty');
    if (password.length < 6) throw new Error('password must be at least 6 characters');
    updateData['passwordHash'] = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  return toUserResponse(user);
}

export async function resetPassword(id: number, input: ResetPasswordInput) {
  if (!input.password?.trim()) throw new Error('password is required');
  if (input.password.length < 6) throw new Error('password must be at least 6 characters');

  const passwordHash = await bcrypt.hash(input.password, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  return { updated: true };
}
