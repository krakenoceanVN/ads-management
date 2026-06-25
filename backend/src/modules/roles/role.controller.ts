import type { Request, Response } from 'express';
import { listRoles, getPermissions, updateRolePermissions } from './role.service';
import { bffData } from '../../shared/response/success';
import { NotFoundError, BadRequestError } from '../../shared/errors/AppError';
import { asyncHandler } from '../../shared/errors/asyncHandler';

export async function getAllRoles(_req: Request, res: Response) {
  const roles = await listRoles();
  res.json(bffData(roles));
}

export async function getAllPermissions(_req: Request, res: Response) {
  const permissions = await getPermissions();
  res.json(bffData(permissions));
}

export async function updatePermissions(req: Request, res: Response) {
  const id = req.params['id'] as string;
  if (!id) throw new NotFoundError('Invalid role id');
  const body = req.body as { permissionKeys?: string[] };
  if (!Array.isArray(body.permissionKeys)) {
    throw new BadRequestError('permissionKeys must be an array of permission key strings');
  }
  const roles = await updateRolePermissions(id, body.permissionKeys);
  res.json(bffData(roles));
}

export const updatePermissionsHandler = asyncHandler(updatePermissions);
