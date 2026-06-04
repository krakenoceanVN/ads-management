import type { Request, Response } from 'express';
import { listUsers, createUser, updateUser, resetPassword } from './user.service';
import { bffData } from '../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError';
import type { CreateUserInput, UpdateUserInput, ResetPasswordInput } from './user.service';

export async function getAll(_req: Request, res: Response) {
  const users = await listUsers();
  res.json(bffData(users));
}

export async function create(req: Request, res: Response) {
  const body = req.body as CreateUserInput;
  if (!body?.username?.trim()) throw new BadRequestError('username is required');
  if (!body?.password?.trim()) throw new BadRequestError('password is required');

  const user = await createUser({
    username: body.username.trim(),
    password: body.password,
    role: body.role,
    permDataInput: body.permDataInput,
    permDataConfirm: body.permDataConfirm,
    permAdmin: body.permAdmin,
    status: body.status,
    roleId: body.roleId,
  });

  res.status(201).json(bffData(user));
}

export async function update(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid user id');
  const body = req.body as UpdateUserInput;
  const user = await updateUser(id, {
    username: body.username?.trim(),
    role: body.role,
    permDataInput: body.permDataInput,
    permDataConfirm: body.permDataConfirm,
    permAdmin: body.permAdmin,
    status: body.status,
    roleId: body.roleId,
    password: body.password,
  });
  res.json(bffData(user));
}

export async function doResetPassword(req: Request, res: Response) {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) throw new NotFoundError('Invalid user id');
  const body = req.body as ResetPasswordInput;
  if (!body?.password?.trim()) throw new BadRequestError('password is required');
  await resetPassword(id, { password: body.password });
  res.json(bffData({ updated: true }));
}
