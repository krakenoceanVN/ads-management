-- Add DownstreamAdType junction table (mirrors UpstreamAdType).
-- Phase 1: non-destructive schema extension.
-- Existing rows in Downstream are untouched. Backfill creates one
-- DownstreamAdType row per existing Downstream using its current adTypeId.

CREATE TABLE IF NOT EXISTS "DownstreamAdType" (
  "id" SERIAL PRIMARY KEY,
  "downstreamId" INTEGER NOT NULL,
  "adTypeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DownstreamAdType_downstreamId_fkey" FOREIGN KEY ("downstreamId") REFERENCES "Downstream"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DownstreamAdType_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DownstreamAdType_downstreamId_adTypeId_key" ON "DownstreamAdType"("downstreamId", "adTypeId");
CREATE INDEX IF NOT EXISTS "DownstreamAdType_downstreamId_idx" ON "DownstreamAdType"("downstreamId");
CREATE INDEX IF NOT EXISTS "DownstreamAdType_adTypeId_idx" ON "DownstreamAdType"("adTypeId");

INSERT INTO "DownstreamAdType" ("downstreamId", "adTypeId")
SELECT "id", "adTypeId"
FROM "Downstream"
ON CONFLICT ("downstreamId", "adTypeId") DO NOTHING;
