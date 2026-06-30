-- Make Upstream.name globally unique (case-insensitive) across active + inactive rows.
-- Service-level precheck uses Prisma `mode: 'insensitive'` for friendly errors.
-- The DB-level functional index below is the authoritative guard (also covers race inserts).

-- Step 1: Defensive cleanup of any existing case-insensitive duplicates.
-- Suffix duplicates (other than the lowest id) so the index can be created safely.
UPDATE "Upstream" u
SET "name" = u."name" || '_archived_' || u."id"
WHERE EXISTS (
  SELECT 1 FROM "Upstream" other
  WHERE other."id" < u."id"
    AND LOWER(other."name") = LOWER(u."name")
);

-- Step 2: Add functional unique index enforcing case-insensitive uniqueness.
CREATE UNIQUE INDEX "Upstream_name_lower_key" ON "Upstream"(LOWER("name"));