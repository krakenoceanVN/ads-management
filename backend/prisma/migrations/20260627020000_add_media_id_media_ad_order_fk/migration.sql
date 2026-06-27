-- MediaId (AdSiteDownstream) gắn với đơn QC media (MediaAdOrder).
-- Thêm FK nullable mediaAdOrderId + index. onDelete SetNull để xoá đơn QC media
-- không làm mất MediaId (giữ toàn vẹn báo cáo).

ALTER TABLE "AdSiteDownstream" ADD COLUMN "mediaAdOrderId" TEXT;

ALTER TABLE "AdSiteDownstream" ADD CONSTRAINT "AdSiteDownstream_mediaAdOrderId_fkey"
  FOREIGN KEY ("mediaAdOrderId") REFERENCES "MediaAdOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdSiteDownstream_mediaAdOrderId_idx" ON "AdSiteDownstream"("mediaAdOrderId");
