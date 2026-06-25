-- Add status column to AdSiteDownstream junction
-- Default 'active' for all existing rows (matches prior mapper hardcode).
ALTER TABLE "AdSiteDownstream" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
