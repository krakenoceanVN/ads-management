-- Add per-pair sequence number to AdOrder.
--
-- Background:
--   AdOrder represents a business entity (campaign/order) scoped to a single
--   (upstreamId, adTypeId) pair. Today the auto-create path sets
--   `name = adType.name`, which collides with the AdType display and makes
--   multiple rows look identical. Going forward:
--     * Auto-generated names follow the pattern `{adType.code}-{seq padded 3}`.
--     * `seq` is per-pair, monotonically increasing.
--     * Users can override `name` arbitrarily; we never overwrite it on edit.
--
-- Migration steps:
--   1. Add `seq` as nullable INTEGER.
--   2. Backfill `seq` per (upstreamId, adTypeId) using ROW_NUMBER ordered by id.
--   3. Set NOT NULL once backfill is complete.
--   4. Create unique index on (upstreamId, adTypeId, seq) — the backstop that
--      lets application code rely on MAX(seq)+1 + retry-on-P2002 for concurrency
--      safety without taking row-level locks.
--   5. Backfill `name` for rows that are still carrying the legacy
--      `name = AdType.name` value. Rows the user has renamed (e.g. "71372361")
--      are preserved — the WHERE clause filters by equality to AdType.name.

ALTER TABLE "AdOrder" ADD COLUMN "seq" INTEGER;

UPDATE "AdOrder" AS o
SET "seq" = sub.rn
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "upstreamId", "adTypeId" ORDER BY id) AS rn
  FROM "AdOrder"
) AS sub
WHERE o.id = sub.id;

ALTER TABLE "AdOrder" ALTER COLUMN "seq" SET NOT NULL;

CREATE UNIQUE INDEX "AdOrder_upstreamId_adTypeId_seq_key"
  ON "AdOrder" ("upstreamId", "adTypeId", "seq");

-- Backfill display name for legacy rows whose name duplicates the AdType name.
-- Per project rule: do NOT touch rows the user has renamed.
UPDATE "AdOrder" AS o
SET "name" = t."code" || '-' || LPAD(o."seq"::text, 3, '0')
FROM "AdType" AS t
WHERE o."adTypeId" = t."id"
  AND o."name" = t."name";
