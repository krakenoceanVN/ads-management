-- Canonical rename: billingMethod 'RATIO' → 'CPS'.
--
-- Background:
--   AdSite.billingMethod is a free-form String column (not a Postgres enum).
--   The UI always displays RATIO as "CPS" via the apiTypeToUiType mapping,
--   but the DB still stores the legacy literal "RATIO". This dual-naming
--   setup caused recurring bugs: any code path that rendered billingMethod
--   raw (e.g. via _count aggregations flowing into the AdOrder list) would
--   surface "RATIO" to the user, who only ever sees "CPS" elsewhere.
--
-- Goal:
--   Make DB values, code types, and UI labels agree on a single canonical
--   value: 'CPS'. The input-accept layer still tolerates incoming 'RATIO'
--   (legacy imports, partner systems) and maps it to 'CPS' on write —
--   only the *output* side stops emitting 'RATIO'.
--
-- This migration is safe to re-run (idempotent WHERE filter).

UPDATE "AdSite"
SET "billingMethod" = 'CPS'
WHERE "billingMethod" = 'RATIO';