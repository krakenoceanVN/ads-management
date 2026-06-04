import type { User } from '../../shared/prisma/client';
import type { AuthUser, LoginInput } from './auth.types';
export { AuthUser, LoginInput };
export declare function login(input: LoginInput): Promise<{
    token: string;
    user: AuthUser;
}>;
export declare function getUserById(id: number): Promise<AuthUser | null>;
export declare function buildAuthUser(user: User, permissions: string[]): AuthUser;
//# sourceMappingURL=auth.service.d.ts.map