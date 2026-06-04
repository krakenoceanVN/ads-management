/**
 * AdType BFF Write Service
 * Handles create, update, and delete for AdType.
 * Delete is soft-blocked if referenced by business records.
 */
export interface CreateAdTypeInput {
    code: string;
    name: string;
}
export interface UpdateAdTypeInput {
    code?: string;
    name?: string;
}
export declare function createAdType(input: CreateAdTypeInput): Promise<{
    id: number;
    code: string;
    name: string;
}>;
export declare function updateAdType(id: number, input: UpdateAdTypeInput): Promise<{
    id: number;
    code: string;
    name: string;
}>;
export declare function deleteAdType(id: number): Promise<{
    deleted: boolean;
}>;
//# sourceMappingURL=adType.write.service.d.ts.map