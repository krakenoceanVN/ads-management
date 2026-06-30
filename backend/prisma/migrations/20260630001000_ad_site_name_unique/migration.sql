-- Make AdSite.name globally unique (case-insensitive) across active + inactive rows.
-- Service-level precheck uses Prisma `mode: 'insensitive'` for friendly errors.
-- The DB-level functional index below is the authoritative guard (also covers race inserts).

-- Step 1: Defensive cleanup of any existing case-insensitive duplicates.
-- Suffix duplicates (other than the lowest id) so the index can be created safely.
UPDATE "AdSite" s
SET "name" = s."name" || '_archived_' || s."id"
WHERE EXISTS (
  SELECT 1 FROM "AdSite" other
  WHERE other."id" < s."id"
    AND LOWER(other."name") = LOWER(s."name")
);

-- Step 2: Add functional unique index enforcing case-insensitive uniqueness.
CREATE UNIQUE INDEX "AdSite_name_lower_key" ON "AdSite"(LOWER("name"));