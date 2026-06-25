-- A1.1: Bảng MediaAdOrder mới (đơn quảng cáo của media/AdSite, tách khỏi AdOrder của Upstream)
CREATE TABLE "MediaAdOrder" (
  "id"        TEXT PRIMARY KEY,
  "adSiteId"  TEXT NOT NULL,
  "adTypeId"  TEXT NOT NULL,
  "seq"       INTEGER NOT NULL,
  "name"      TEXT NOT NULL,
  "notes"     TEXT,
  "status"    TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL,
  CONSTRAINT "MediaAdOrder_adSiteId_fkey" FOREIGN KEY ("adSiteId") REFERENCES "AdSite"("id") ON DELETE CASCADE,
  CONSTRAINT "MediaAdOrder_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id")
);

CREATE UNIQUE INDEX "MediaAdOrder_adSiteId_adTypeId_seq_key"
  ON "MediaAdOrder"("adSiteId", "adTypeId", "seq");
CREATE INDEX "MediaAdOrder_adSiteId_idx" ON "MediaAdOrder"("adSiteId");
CREATE INDEX "MediaAdOrder_adTypeId_idx" ON "MediaAdOrder"("adTypeId");
CREATE INDEX "MediaAdOrder_status_idx" ON "MediaAdOrder"("status");

-- A1.2: Thêm cột notes vào AdSiteDownstream cho mục 2.3 (Ghi chú)
ALTER TABLE "AdSiteDownstream" ADD COLUMN "notes" TEXT;