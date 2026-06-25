-- Drop legacy Downstream.payoutRate column.
-- Per-junction rates are now configured via AdSiteDownstream.customPrice,
-- DailyDownstreamRate.effectiveRate, or DownstreamPeriod.unitPrice.
-- Records that had no other rate configuration will now resolve to
-- "No payout rate found" errors until a period or customPrice is set.

ALTER TABLE "Downstream" DROP COLUMN "payoutRate";