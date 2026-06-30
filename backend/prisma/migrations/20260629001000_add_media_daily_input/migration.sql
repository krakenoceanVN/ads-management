-- Add MediaDailyInput table for per-day dataCoefficient persistence on Media Data Entry

CREATE TABLE "MediaDailyInput" (
  "id" TEXT PRIMARY KEY,
  "recordDate" TIMESTAMP(3) NOT NULL,
  "adSiteDownstreamId" TEXT NOT NULL,
  "dataCoefficient" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
  "status" TEXT NOT NULL DEFAULT 'unconfirmed',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaDailyInput_adSiteDownstreamId_fkey"
    FOREIGN KEY ("adSiteDownstreamId") REFERENCES "AdSiteDownstream"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "MediaDailyInput_recordDate_adSiteDownstreamId_key"
  ON "MediaDailyInput"("recordDate", "adSiteDownstreamId");
CREATE INDEX "MediaDailyInput_adSiteDownstreamId_idx" ON "MediaDailyInput"("adSiteDownstreamId");
CREATE INDEX "MediaDailyInput_recordDate_idx" ON "MediaDailyInput"("recordDate");
CREATE INDEX "MediaDailyInput_status_idx" ON "MediaDailyInput"("status");