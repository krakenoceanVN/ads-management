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
export declare function listUsers(): Promise<UserResponse[]>;
export declare function createUser(input: CreateUserInput): Promise<UserResponse>;
export declare function updateUser(id: number, input: UpdateUserInput): Promise<UserResponse>;
export declare function resetPassword(id: number, input: ResetPasswordInput): Promise<{
    updated: boolean;
}>;
//# sourceMappingURL=user.service.d.ts.map