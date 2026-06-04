export interface BffErrorResponse {
    success: false;
    data?: never;
    error: string;
    code?: string;
}
export declare function bffError(message: string, code?: string): BffErrorResponse;
//# sourceMappingURL=error.d.ts.map