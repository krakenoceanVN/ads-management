"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const AppError_1 = require("./AppError");
function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
        });
        return;
    }
    console.error('[errorHandler] Unexpected error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message,
        code: 'INTERNAL_ERROR',
    });
}
//# sourceMappingURL=errorHandler.js.map