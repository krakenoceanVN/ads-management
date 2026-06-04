/**
 * Phase 5B: Operation Log Service
 *
 * Read-only operation log retrieval with filtering and pagination.
 * Logs ordered by createdAt DESC.
 */
export interface OperationLogParams {
    startDate?: string;
    endDate?: string;
    keyword?: string;
    module?: string;
    action?: string;
    page?: number;
    pageSize?: number;
}
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
export declare function listOperationLogs(params: OperationLogParams): Promise<PaginatedResult<any>>;
//# sourceMappingURL=oplog.service.d.ts.map