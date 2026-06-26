"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediaId = createMediaId;
exports.updateMediaId = updateMediaId;
exports.deleteMediaId = deleteMediaId;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
const AppError_1 = require("../../../shared/errors/AppError");
async function createMediaId(input) {
    const { adSiteId, downstreamId, customPrice, pctHal, mediaAdTypeId, mediaIdName, status } = input;
    if (!adSiteId)
        throw new AppError_1.BadRequestError('adSiteId is required');
    if (!downstreamId)
        throw new AppError_1.BadRequestError('downstreamId is required');
    const adSite = await client_1.prisma.adSite.findUnique({
        where: { id: adSiteId },
        include: { upstream: true },
    });
    if (!adSite)
        throw new AppError_1.BadRequestError(`AdSite (ID quảng cáo) with id '${adSiteId}' does not exist`);
    const downstream = await client_1.prisma.downstream.findUnique({
        where: { id: downstreamId },
        include: { adTypeLinks: { include: { adType: true } } },
    });
    if (!downstream)
        throw new AppError_1.BadRequestError(`Downstream with id '${downstreamId}' does not exist`);
    const adSiteAdTypeId = adSite.upstream.adTypeId;
    // Only enforce adType match when both sides have an adType set
    if (adSiteAdTypeId && downstream.adTypeLinks.length > 0) {
        const allowedAdTypeIds = new Set(downstream.adTypeLinks.map(link => link.adTypeId));
        if (!allowedAdTypeIds.has(adSiteAdTypeId)) {
            throw new AppError_1.BadRequestError('Media (ID quảng cáo) and downstream must use the same ad type');
        }
    }
    if (downstream.status !== 'active') {
        throw new AppError_1.BadRequestError('Cannot link to an inactive downstream');
    }
    const existing = await client_1.prisma.adSiteDownstream.findUnique({
        where: { adSiteId_downstreamId: { adSiteId, downstreamId } },
    });
    if (existing) {
        throw new AppError_1.ConflictError('This ID media (AdSite + downstream) already exists');
    }
    // Validate mediaAdTypeId if provided — must exist in AdType
    if (mediaAdTypeId) {
        const at = await client_1.prisma.adType.findUnique({ where: { id: mediaAdTypeId } });
        if (!at)
            throw new AppError_1.BadRequestError(`AdType with id '${mediaAdTypeId}' does not exist`);
    }
    const { Prisma } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
    const row = await client_1.prisma.adSiteDownstream.create({
        data: {
            id: `asd_${adSiteId}_${downstreamId}`,
            adSiteId,
            downstreamId,
            customPrice: customPrice != null ? new Prisma.Decimal(customPrice) : null,
            pctHal: pctHal != null ? new Prisma.Decimal(pctHal) : null,
            mediaAdTypeId: mediaAdTypeId ?? null,
            mediaIdName: mediaIdName ?? null,
            status: status ?? 'active',
        },
        include: {
            adSite: { include: { upstream: { include: { defaultAdType: true } } } },
            downstream: true,
            mediaAdType: true,
        },
    });
    return (0, mappers_1.mapMediaId)(row);
}
async function updateMediaId(junctionId, input) {
    const { customPrice, pctHal, mediaAdTypeId, mediaIdName, status } = input;
    const { Prisma } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
    // Validate mediaAdTypeId if provided — must exist in AdType
    if (mediaAdTypeId) {
        const at = await client_1.prisma.adType.findUnique({ where: { id: mediaAdTypeId } });
        if (!at)
            throw new AppError_1.BadRequestError(`AdType with id '${mediaAdTypeId}' does not exist`);
    }
    const row = await client_1.prisma.adSiteDownstream.update({
        where: { id: junctionId },
        data: {
            ...(customPrice !== undefined
                ? (customPrice === null
                    ? { customPrice: null }
                    : { customPrice: new Prisma.Decimal(customPrice) })
                : {}),
            ...(pctHal !== undefined
                ? (pctHal === null
                    ? { pctHal: null }
                    : { pctHal: new Prisma.Decimal(pctHal) })
                : {}),
            ...(mediaAdTypeId !== undefined ? { mediaAdTypeId: mediaAdTypeId ?? null } : {}),
            ...(mediaIdName !== undefined ? { mediaIdName: mediaIdName ?? null } : {}),
            ...(status !== undefined ? { status } : {}),
        },
        include: {
            adSite: { include: { upstream: { include: { defaultAdType: true } } } },
            downstream: true,
            mediaAdType: true,
        },
    });
    return (0, mappers_1.mapMediaId)(row);
}
async function deleteMediaId(_junctionId) {
    throw new AppError_1.ConflictError('Cannot delete MediaId: deleting media/downstream mapping is disabled to preserve historical reporting and settlement integrity.');
}
//# sourceMappingURL=mediaId.write.service.js.map