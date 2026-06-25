const { PrismaClient } = require('@prisma/client');
const { updateMediaId } = require('./dist/modules/bff/media-ids/mediaId.write.service');
const prisma = new PrismaClient();
(async () => {
  const r = await updateMediaId('asd_xaQcn9_lOfjIG', {
    customPrice: 77.7,
    pctHal: 0.42,
    mediaAdTypeCode: 'baidu',
    mediaIdName: 'update-via-service',
  });
  console.log('Result:', JSON.stringify(r, null, 2));
  const check = await prisma.adSiteDownstream.findUnique({ where: { id: 'asd_xaQcn9_lOfjIG' } });
  console.log('DB:', JSON.stringify(check, null, 2));
  await prisma.$disconnect();
})();
