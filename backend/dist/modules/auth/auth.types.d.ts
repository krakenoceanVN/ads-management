import type { User } from '../../shared/prisma/client';
export interface AuthUser {
    id: number;
    username: string;
    role: string;
    permDataInput: boolean;
    permDataConfirm: boolean;
    permAdmin: boolean;
    status: string;
    roleId: number | null;
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
//# sourceMappingURL=auth.types.d.ts.map