export declare function listRoles(): Promise<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
    permissions: string[];
}[]>;
export declare function getPermissions(): Promise<{
    id: string;
    key: string;
    module: string;
    action: string;
    name: string;
    description: string | null;
}[]>;
export declare function updateRolePermissions(roleId: string, permissionKeys: string[]): Promise<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
    permissions: string[];
}[]>;
//# sourceMappingURL=role.service.d.ts.map