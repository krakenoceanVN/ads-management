-- Add mediaAdTypeCode + mediaIdName to AdSiteDownstream for the "Tạo ID media" form

ALTER TABLE "AdSiteDownstream"
  ADD COLUMN "mediaAdTypeCode" TEXT,
  ADD COLUMN "mediaIdName"      TEXT;

CREATE INDEX "AdSiteDownstream_mediaAdTypeCode_idx" ON "AdSiteDownstream"("mediaAdTypeCode");
