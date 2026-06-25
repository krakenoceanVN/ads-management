export interface CreateUserInput {
    username: string;
    password: string;
    role?: string;
    permDataInput?: boolean;
    permDataConfirm?: boolean;
    permAdmin?: boolean;
    status?: string;
    roleId?: string | null;
}
export interface UpdateUserInput {
    username?: string;
    role?: string;
    permDataInput?: boolean;
    permDataConfirm?: boolean;
    permAdmin?: boolean;
    status?: string;
    roleId?: string | null;
    password?: string;
}
export interface ResetPasswordInput {
    password: string;
}
export interface UserResponse {
    id: string;
    username: string;
    role: string;
    permDataInput: boolean;
    permDataConfirm: boolean;
    permAdmin: boolean;
    status: string;
    roleId: string | null;
    createdAt: Date;
    lastLoginAt: Date | null;
}
export declare function listUsers(): Promise<UserResponse[]>;
export declare function createUser(input: CreateUserInput): Promise<UserResponse>;
export declare function updateUser(id: string, input: UpdateUserInput): Promise<UserResponse>;
export declare function resetPassword(id: string, input: ResetPasswordInput): Promise<{
    updated: boolean;
}>;
//# sourceMappingURL=user.service.d.ts.map