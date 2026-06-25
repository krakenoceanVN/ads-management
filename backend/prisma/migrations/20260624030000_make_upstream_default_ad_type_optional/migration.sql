-- Make Upstream.defaultAdType relation optional to support advertisers without adType
ALTER TABLE "Upstream" ALTER COLUMN "adTypeId" DROP NOT NULL;
