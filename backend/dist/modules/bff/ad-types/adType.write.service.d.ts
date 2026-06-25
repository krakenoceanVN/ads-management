/**
 * AdType BFF Write Service
 * Handles create, update, and delete for AdType.
 * Delete is soft-blocked if referenced by business records.
 *
 * Per docx mục 1.2: AdType giữ vai trò "đơn quảng cáo của nhà QC".
 * Không còn field `code` — `id` (6-char alphanumeric) là identifier duy nhất.
 */
export interface CreateAdTypeInput {
    name: string;
    upstreamId?: string | null;
    notes?: string | null;
    status?: 'active' | 'inactive';
}
export interface UpdateAdTypeInput {
    name?: string;
    upstreamId?: string | null;
    notes?: string | null;
    status?: 'active' | 'inactive';
}
export interface AdTypeDto {
    id: string;
    name: string;
    upstreamId: string | null;
    notes: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export declare function createAdType(input: CreateAdTypeInput): Promise<AdTypeDto>;
export declare function updateAdType(id: string, input: UpdateAdTypeInput): Promise<AdTypeDto>;
export declare function deleteAdType(id: string): Promise<{
    deleted: boolean;
}>;
//# sourceMappingURL=adType.write.service.d.ts.map