-- Drop AdType.code (use id as unique identifier)
-- Chuyển AdSiteDownstream.mediaAdTypeCode (String) → mediaAdTypeId (FK to AdType.id)

-- A2.1: Thêm cột mediaAdTypeId cho AdSiteDownstream
ALTER TABLE "AdSiteDownstream" ADD COLUMN "mediaAdTypeId" TEXT;

-- A2.2: Backfill mediaAdTypeId từ mediaAdTypeCode (lookup AdType.id)
UPDATE "AdSiteDownstream" asd
SET "mediaAdTypeId" = (
  SELECT at.id FROM "AdType" at
  WHERE at.code = asd."mediaAdTypeCode"
  LIMIT 1
)
WHERE asd."mediaAdTypeId" IS NULL AND asd."mediaAdTypeCode" IS NOT NULL;

-- A2.3: Add FK + index cho AdSiteDownstream.mediaAdTypeId
ALTER TABLE "AdSiteDownstream" ADD CONSTRAINT "AdSiteDownstream_mediaAdTypeId_fkey"
  FOREIGN KEY ("mediaAdTypeId") REFERENCES "AdType"("id") ON DELETE SET NULL;
CREATE INDEX "AdSiteDownstream_mediaAdTypeId_idx" ON "AdSiteDownstream"("mediaAdTypeId");

-- A2.4: Drop cũ
DROP INDEX IF EXISTS "AdSiteDownstream_mediaAdTypeCode_idx";
ALTER TABLE "AdSiteDownstream" DROP COLUMN "mediaAdTypeCode";

-- A2.5: Drop AdType.code + unique index
DROP INDEX IF EXISTS "AdType_code_key";
ALTER TABLE "AdType" DROP COLUMN "code";
