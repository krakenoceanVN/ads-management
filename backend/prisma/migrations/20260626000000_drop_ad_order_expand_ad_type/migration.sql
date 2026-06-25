-- A2.1: Thêm field mới vào AdType
ALTER TABLE "AdType" ADD COLUMN "upstreamId" TEXT;
ALTER TABLE "AdType" ADD COLUMN "notes" TEXT;
ALTER TABLE "AdType" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
CREATE INDEX "AdType_upstreamId_idx" ON "AdType"("upstreamId");
CREATE INDEX "AdType_status_idx" ON "AdType"("status");
ALTER TABLE "AdType" ADD CONSTRAINT "AdType_upstreamId_fkey"
  FOREIGN KEY ("upstreamId") REFERENCES "Upstream"("id");

-- A2.2: Drop FK + column AdOrder trên AdSite
ALTER TABLE "AdSite" DROP CONSTRAINT IF EXISTS "AdSite_adOrderId_fkey";
DROP INDEX IF EXISTS "AdSite_adOrderId_idx";
ALTER TABLE "AdSite" DROP COLUMN "adOrderId";

-- A2.3: Drop bảng AdOrder (cascade FK)
DROP TABLE IF EXISTS "AdOrder";