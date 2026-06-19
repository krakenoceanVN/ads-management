import 'dotenv/config';
import { prisma } from '../src/shared/prisma/client';

(async () => {
  const nulls: { n: number }[] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS n FROM "AdSite" WHERE "adOrderId" IS NULL'
  );
  const total: { n: number }[] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS n FROM "AdSite"'
  );
  const withOrder: { n: number }[] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS n FROM "AdSite" WHERE "adOrderId" IS NOT NULL'
  );
  console.log(JSON.stringify({
    total: total[0].n,
    withAdOrderId: withOrder[0].n,
    nullAdOrderId: nulls[0].n,
  }, null, 2));
  await prisma.$disconnect();
})();