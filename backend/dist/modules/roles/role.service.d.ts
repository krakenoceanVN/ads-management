export declare function listRoles(): Promise<{
    id: number;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
    permissions: string[];
}[]>;
export declare function getPermissions(): Promise<{
    id: number;
    key: string;
    module: string;
    action: string;
    name: string;
    description: string | null;
}[]>;
export declare function updateRolePermissions(roleId: number, permissionKeys: string[]): Promise<{
    id: number;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
    permissions: string[];
}[]>;
//# sourceMappingURL=role.service.d.ts.map