import type { Request, Response } from 'express';
export declare function getAllRoles(_req: Request, res: Response): Promise<void>;
export declare function getAllPermissions(_req: Request, res: Response): Promise<void>;
export declare function updatePermissions(req: Request, res: Response): Promise<void>;
export declare const updatePermissionsHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
//# sourceMappingURL=role.controller.d.ts.map