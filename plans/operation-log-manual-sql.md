# OperationLog Manual SQL

## Context

This project uses Supabase PostgreSQL.

Prisma Migrate is not currently used for this database. The folder `prisma/migrations/` does not exist, and the live database is not managed by Prisma Migrate.

The `OperationLog` model exists in `prisma/schema.prisma`, but the live Supabase table must be created manually when setting up a new database.

## Manual SQL

Run the following SQL in Supabase SQL Editor or through a trusted PostgreSQL client:

```sql
CREATE TABLE IF NOT EXISTS "OperationLog" (
  "id" SERIAL PRIMARY KEY,
  "userId" INT,
  "username" TEXT,
  "action" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "detail" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "OperationLog_createdAt_idx" ON "OperationLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "OperationLog_module_idx" ON "OperationLog" ("module");
CREATE INDEX IF NOT EXISTS "OperationLog_action_idx" ON "OperationLog" ("action");
CREATE INDEX IF NOT EXISTS "OperationLog_userId_idx" ON "OperationLog" ("userId");
```

## Verification SQL

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'OperationLog'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'OperationLog';
```

## Notes

- Do not run `prisma migrate dev` or `prisma db push` against the production Supabase database unless the project intentionally adopts Prisma Migrate later.
- This table is used by the backend fire-and-forget operation logger:
  - Auth login success/failure
  - Advertiser create/update/delete
  - Media create/update/delete
  - DataEntry save/confirm/unconfirm
- Logging failures must not block business operations.