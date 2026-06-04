"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdvertiser = createAdvertiser;
exports.updateAdvertiser = updateAdvertiser;
exports.deleteAdvertiser = deleteAdvertiser;
const client_1 = require("../../../shared/prisma/client");
const mappers_1 = require("../mappers");
async function createAdvertiser(input) {
    const { adTypeCode, ...rest } = input;
    const row = await client_1.prisma.upstream.create({
        data: {
            name: rest.name,
            contact: rest.contact ?? null,
            phone: rest.phone ?? null,
            email: rest.email ?? null,
            notes: rest.notes ?? null,
            status: rest.status ?? 'active',
            adType: { connect: { code: adTypeCode } },
        },
        include: { adType: true },
    });
    return (0, mappers_1.mapAdvertiser)(row);
}
async function updateAdvertiser(id, input) {
    const { adTypeCode, ...rest } = input;
    const row = await client_1.prisma.upstream.update({
        where: { id },
        data: {
            ...(rest.name !== undefined && { name: rest.name }),
            ...(rest.contact !== undefined && { contact: rest.contact }),
            ...(rest.phone !== undefined && { phone: rest.phone }),
            ...(rest.email !== undefined && { email: rest.email }),
            ...(rest.notes !== undefined && { notes: rest.notes }),
            ...(rest.status !== undefined && { status: rest.status }),
            ...(adTypeCode !== undefined && { adType: { connect: { code: adTypeCode } } }),
        },
        include: { adType: true },
    });
    return (0, mappers_1.mapAdvertiser)(row);
}
async function deleteAdvertiser(id) {
    // Soft delete: set status to inactive
    const row = await client_1.prisma.upstream.update({
        where: { id },
        data: { status: 'inactive' },
        include: { adType: true },
    });
    return (0, mappers_1.mapAdvertiser)(row);
}
//# sourceMappingURL=advertiser.write.service.js.map