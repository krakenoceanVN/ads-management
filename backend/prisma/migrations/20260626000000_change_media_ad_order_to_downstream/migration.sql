-- Change MediaAdOrder.adSiteId → MediaAdOrder.downstreamId
-- Backfill via AdSiteDownstream junction, then drop old FK/column.

-- A2.1: Thêm cột mới (nullable để backfill)
ALTER TABLE "MediaAdOrder" ADD COLUMN "downstreamId" TEXT;

-- A2.2: Backfill từ AdSiteDownstream (lấy downstreamId đầu tiên cho mỗi adSiteId)
UPDATE "MediaAdOrder" mao
SET "downstreamId" = (
  SELECT asd."downstreamId"
  FROM "AdSiteDownstream" asd
  WHERE asd."adSiteId" = mao."adSiteId"
  LIMIT 1
)
WHERE mao."downstreamId" IS NULL;

-- A2.3: Với rows không có AdSiteDownstream (orphan), tạo placeholder Downstream
INSERT INTO "Downstream" (id, "downstreamType", status, "createdAt", "updatedAt")
SELECT 'ORPHAN_' || mao.id, 'ORPHAN', 'inactive', NOW(), NOW()
FROM "MediaAdOrder" mao
WHERE mao."downstreamId" IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE "MediaAdOrder" mao
SET "downstreamId" = 'ORPHAN_' || mao.id
WHERE mao."downstreamId" IS NULL;

-- A2.4: Set NOT NULL + FK mới
ALTER TABLE "MediaAdOrder" ALTER COLUMN "downstreamId" SET NOT NULL;
ALTER TABLE "MediaAdOrder" ADD CONSTRAINT "MediaAdOrder_downstreamId_fkey"
  FOREIGN KEY ("downstreamId") REFERENCES "Downstream"("id") ON DELETE CASCADE;

-- A2.5: Drop FK cũ + column adSiteId
ALTER TABLE "MediaAdOrder" DROP CONSTRAINT IF EXISTS "MediaAdOrder_adSiteId_fkey";
DROP INDEX IF EXISTS "MediaAdOrder_adSiteId_idx";
ALTER TABLE "MediaAdOrder" DROP COLUMN "adSiteId";

-- A2.6: Recreate unique constraint theo downstreamId
DROP INDEX IF EXISTS "MediaAdOrder_adSiteId_adTypeId_seq_key";
CREATE UNIQUE INDEX "MediaAdOrder_downstreamId_adTypeId_seq_key"
  ON "MediaAdOrder"("downstreamId", "adTypeId", "seq");
CREATE INDEX "MediaAdOrder_downstreamId_idx" ON "MediaAdOrder"("downstreamId");
