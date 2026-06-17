-- Phase-2 destructive cleanup.
-- DS 2 (ML+SM) is the keeper. DS 3 (ML+IQIYI) and DS 4 (ML+360) are duplicates
-- with identical payoutRate (0.8), status (active), and downstreamType (ML).
-- Pre-flight snapshot is saved to backend/scripts/_phase2_snapshot.json.

-- 1. Re-point junctions from DS 3/4 to DS 2.
UPDATE "AdSiteDownstream"
SET "downstreamId" = 2
WHERE "downstreamId" IN (3, 4);

-- 2. Move their DownstreamAdType links to DS 2.
INSERT INTO "DownstreamAdType" ("downstreamId", "adTypeId")
SELECT 2, "adTypeId"
FROM "DownstreamAdType"
WHERE "downstreamId" IN (3, 4)
ON CONFLICT ("downstreamId", "adTypeId") DO NOTHING;

DELETE FROM "DownstreamAdType"
WHERE "downstreamId" IN (3, 4);

-- 3. Delete the duplicate Downstream rows.
-- DownstreamPeriod and DailyDownstreamRate FKs cascade-delete automatically
-- (verified empty for DS 3/4 in snapshot).
DELETE FROM "Downstream" WHERE "id" IN (3, 4);

-- 4. Drop the legacy scalar adTypeId column. The junction is now the single
-- source of truth for which AdTypes a Downstream owns.
ALTER TABLE "Downstream" DROP CONSTRAINT IF EXISTS "Downstream_adTypeId_fkey";
DROP INDEX IF EXISTS "Downstream_adTypeId_idx";
ALTER TABLE "Downstream" DROP COLUMN "adTypeId";

-- 5. Enforce downstreamType uniqueness on active rows so Phase-1's controller
-- check is now DB-enforced. Partial index lets deactivated duplicates exist
-- for historical reporting.
CREATE UNIQUE INDEX IF NOT EXISTS "Downstream_downstreamType_active_key"
  ON "Downstream"("downstreamType")
  WHERE "status" = 'active';
