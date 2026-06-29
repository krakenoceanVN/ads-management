-- AdSite: them adTypeId (don QC rieng cho tung ma QC). Nullable, khong backfill.
-- Thay the co che suy don tu Upstream.defaultAdType bang lua chon per-AdSite.
ALTER TABLE "AdSite" ADD COLUMN "adTypeId" TEXT;

ALTER TABLE "AdSite" ADD CONSTRAINT "AdSite_adTypeId_fkey"
  FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdSite_adTypeId_idx" ON "AdSite"("adTypeId");
