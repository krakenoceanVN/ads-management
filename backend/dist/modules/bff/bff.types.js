"use strict";
// BFF shared types — mirrors frontend bffTypes.ts interfaces
// These are used by BFF mappers and controllers
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBillingMethodForStorage = normalizeBillingMethodForStorage;
function normalizeBillingMethodForStorage(type) {
    if (type === undefined)
        return undefined;
    if (type === 'CPS')
        return 'RATIO';
    if (type === 'CPM' || type === 'RATIO' || type === 'CPA')
        return type;
    return undefined;
}
//# sourceMappingURL=bff.types.js.map