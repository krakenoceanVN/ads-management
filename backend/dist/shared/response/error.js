"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bffError = bffError;
function bffError(message, code) {
    return { success: false, error: message, code };
}
//# sourceMappingURL=error.js.map