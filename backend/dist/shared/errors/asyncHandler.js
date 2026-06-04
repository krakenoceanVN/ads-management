"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
/**
 * Wraps an async route handler so unhandled promise rejections are forwarded
 * to the Express error handler instead of crashing the Node process.
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=asyncHandler.js.map