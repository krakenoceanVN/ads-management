const { updateMediaId } = require('./dist/modules/bff/media-ids/mediaId.write.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const r = await updateMediaId('asd_xaQcn9_lOfjIG', {
    customPrice: 55.5,
    pctHal: 0.6,
    mediaAdTypeCode: 'sm',
    mediaIdName: 'final-test',
  });
  console.log('Result pctHal:', r.pctHal, 'mediaIdName:', r.mediaIdName, 'mediaAdTypeCode:', r.mediaAdTypeCode);
  const check = await prisma.adSiteDownstream.findUnique({ where: { id: 'asd_xaQcn9_lOfjIG' } });
  console.log('DB:', JSON.stringify(check, null, 2));
  await prisma.$disconnect();
})();
