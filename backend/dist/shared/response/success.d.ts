export interface BffDataResponse<T> {
    success: true;
    data: T;
    error?: never;
    message?: never;
}
export declare function bffData<T>(data: T): BffDataResponse<T>;
//# sourceMappingURL=success.d.ts.map