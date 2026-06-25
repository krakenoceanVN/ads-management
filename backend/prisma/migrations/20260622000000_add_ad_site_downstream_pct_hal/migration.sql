-- Add pctHal column to AdSiteDownstream junction table.
-- Allows per-(AdSite, Downstream) share ratio override.
-- null = fall back to DownstreamPeriod.pctHal (existing behavior preserved).
-- Non-destructive: existing rows get null, no backfill required.

ALTER TABLE "AdSiteDownstream"
  ADD COLUMN IF NOT EXISTS "pctHal" DECIMAL(65,30);
