CREATE TABLE IF NOT EXISTS "UpstreamAdType" (
  "id" SERIAL PRIMARY KEY,
  "upstreamId" INTEGER NOT NULL,
  "adTypeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UpstreamAdType_upstreamId_fkey" FOREIGN KEY ("upstreamId") REFERENCES "Upstream"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UpstreamAdType_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UpstreamAdType_upstreamId_adTypeId_key" ON "UpstreamAdType"("upstreamId", "adTypeId");
CREATE INDEX IF NOT EXISTS "UpstreamAdType_upstreamId_idx" ON "UpstreamAdType"("upstreamId");
CREATE INDEX IF NOT EXISTS "UpstreamAdType_adTypeId_idx" ON "UpstreamAdType"("adTypeId");

INSERT INTO "UpstreamAdType" ("upstreamId", "adTypeId")
SELECT "id", "adTypeId"
FROM "Upstream"
ON CONFLICT ("upstreamId", "adTypeId") DO NOTHING;
