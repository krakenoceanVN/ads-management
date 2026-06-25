"use strict";
// BFF shared types — mirrors frontend bffTypes.ts interfaces
// These are used by BFF mappers and controllers
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBillingMethodForStorage = normalizeBillingMethodForStorage;
function normalizeBillingMethodForStorage(type) {
    if (type === undefined)
        return undefined;
    if (type === 'CPM' || type === 'CPS' || type === 'CPA')
        return type;
    if (type === 'RATIO')
        return 'CPS';
    return undefined;
}
//# sourceMappingURL=bff.types.js.map