-- DropForeignKey
ALTER TABLE "AdOrder" DROP CONSTRAINT "AdOrder_adTypeId_fkey";

-- DropForeignKey
ALTER TABLE "AdOrder" DROP CONSTRAINT "AdOrder_upstreamId_fkey";

-- DropForeignKey
ALTER TABLE "AdSite" DROP CONSTRAINT "AdSite_adOrderId_fkey";

-- DropForeignKey
ALTER TABLE "AdSite" DROP CONSTRAINT "AdSite_upstreamId_fkey";

-- DropForeignKey
ALTER TABLE "AdSiteDownstream" DROP CONSTRAINT "AdSiteDownstream_adSiteId_fkey";

-- DropForeignKey
ALTER TABLE "AdSiteDownstream" DROP CONSTRAINT "AdSiteDownstream_downstreamId_fkey";

-- DropForeignKey
ALTER TABLE "AdSiteEvent" DROP CONSTRAINT "AdSiteEvent_adSiteId_fkey";

-- DropForeignKey
ALTER TABLE "AdSiteRebateRate" DROP CONSTRAINT "AdSiteRebateRate_adSiteId_fkey";

-- DropForeignKey
ALTER TABLE "DailyDownstreamRate" DROP CONSTRAINT "DailyDownstreamRate_downstreamId_fkey";

-- DropForeignKey
ALTER TABLE "DailyInput" DROP CONSTRAINT "DailyInput_adSiteId_fkey";

-- DropForeignKey
ALTER TABLE "DailyInput" DROP CONSTRAINT "DailyInput_quarantineBatchId_fkey";

-- DropForeignKey
ALTER TABLE "DailyInputQuarantineRecord" DROP CONSTRAINT "DailyInputQuarantineRecord_batchId_fkey";

-- DropForeignKey
ALTER TABLE "DailyInputQuarantineRecord" DROP CONSTRAINT "DailyInputQuarantineRecord_dailyInputId_fkey";

-- DropForeignKey
ALTER TABLE "DownstreamAdType" DROP CONSTRAINT "DownstreamAdType_adTypeId_fkey";

-- DropForeignKey
ALTER TABLE "DownstreamAdType" DROP CONSTRAINT "DownstreamAdType_downstreamId_fkey";

-- DropForeignKey
ALTER TABLE "DownstreamPeriod" DROP CONSTRAINT "DownstreamPeriod_downstreamId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Upstream" DROP CONSTRAINT "Upstream_adTypeId_fkey";

-- DropForeignKey
ALTER TABLE "UpstreamAdType" DROP CONSTRAINT "UpstreamAdType_adTypeId_fkey";

-- DropForeignKey
ALTER TABLE "UpstreamAdType" DROP CONSTRAINT "UpstreamAdType_upstreamId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- AlterTable
ALTER TABLE "AdOrder" DROP CONSTRAINT "AdOrder_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "upstreamId" SET DATA TYPE TEXT,
ALTER COLUMN "adTypeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "AdOrder_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AdOrder_id_seq";

-- AlterTable
ALTER TABLE "AdSite" DROP CONSTRAINT "AdSite_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "upstreamId" SET DATA TYPE TEXT,
ALTER COLUMN "adOrderId" SET DATA TYPE TEXT,
ADD CONSTRAINT "AdSite_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AdSite_id_seq";

-- AlterTable
ALTER TABLE "AdSiteDownstream" DROP CONSTRAINT "AdSiteDownstream_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "adSiteId" SET DATA TYPE TEXT,
ALTER COLUMN "downstreamId" SET DATA TYPE TEXT,
ADD CONSTRAINT "AdSiteDownstream_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AdSiteDownstream_id_seq";

-- AlterTable
ALTER TABLE "AdSiteEvent" ALTER COLUMN "adSiteId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "AdSiteRebateRate" ALTER COLUMN "adSiteId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "AdType" DROP CONSTRAINT "AdType_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "AdType_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "DailyDownstreamRate" DROP CONSTRAINT "DailyDownstreamRate_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "downstreamId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DailyDownstreamRate_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DailyDownstreamRate_id_seq";

-- AlterTable
ALTER TABLE "DailyInput" DROP CONSTRAINT "DailyInput_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "adSiteId" SET DATA TYPE TEXT,
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ALTER COLUMN "quarantineBatchId" SET DATA TYPE TEXT,
ALTER COLUMN "quarantinedBy" SET DATA TYPE TEXT,
ADD CONSTRAINT "DailyInput_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DailyInput_id_seq";

-- AlterTable
ALTER TABLE "DailyInputQuarantineBatch" DROP CONSTRAINT "DailyInputQuarantineBatch_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "advertiserId" SET DATA TYPE TEXT,
ALTER COLUMN "adSiteId" SET DATA TYPE TEXT,
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ALTER COLUMN "restoredBy" SET DATA TYPE TEXT,
ADD CONSTRAINT "DailyInputQuarantineBatch_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DailyInputQuarantineBatch_id_seq";

-- AlterTable
ALTER TABLE "DailyInputQuarantineRecord" DROP CONSTRAINT "DailyInputQuarantineRecord_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "batchId" SET DATA TYPE TEXT,
ALTER COLUMN "dailyInputId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DailyInputQuarantineRecord_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DailyInputQuarantineRecord_id_seq";

-- AlterTable
ALTER TABLE "Downstream" DROP CONSTRAINT "Downstream_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Downstream_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Downstream_id_seq";

-- AlterTable
ALTER TABLE "DownstreamAdType" DROP CONSTRAINT "DownstreamAdType_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "downstreamId" SET DATA TYPE TEXT,
ALTER COLUMN "adTypeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "DownstreamAdType_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DownstreamAdType_id_seq";

-- AlterTable
ALTER TABLE "DownstreamPeriod" DROP CONSTRAINT "DownstreamPeriod_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "downstreamId" SET DATA TYPE TEXT,
ALTER COLUMN "createdBy" SET DATA TYPE TEXT,
ADD CONSTRAINT "DownstreamPeriod_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DownstreamPeriod_id_seq";

-- AlterTable
ALTER TABLE "LEDailyCost" DROP CONSTRAINT "LEDailyCost_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "LEDailyCost_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "LEDailyCost_id_seq";

-- AlterTable
ALTER TABLE "OperationLog" DROP CONSTRAINT "OperationLog_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "OperationLog_id_seq";

-- AlterTable
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Permission_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Permission_id_seq";

-- AlterTable
ALTER TABLE "Role" DROP CONSTRAINT "Role_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Role_id_seq";

-- AlterTable
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_pkey",
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ALTER COLUMN "permissionId" SET DATA TYPE TEXT,
ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId");

-- AlterTable
ALTER TABLE "Upstream" DROP CONSTRAINT "Upstream_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "adTypeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Upstream_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Upstream_id_seq";

-- AlterTable
ALTER TABLE "UpstreamAdType" DROP CONSTRAINT "UpstreamAdType_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "upstreamId" SET DATA TYPE TEXT,
ALTER COLUMN "adTypeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "UpstreamAdType_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "UpstreamAdType_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- AlterTable
ALTER TABLE "YiyiDailyData" DROP CONSTRAINT "YiyiDailyData_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "YiyiDailyData_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "YiyiDailyData_id_seq";

-- AlterTable
ALTER TABLE "YiyiDailyPricing" DROP CONSTRAINT "YiyiDailyPricing_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "YiyiDailyPricing_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "YiyiDailyPricing_id_seq";

-- AddForeignKey
ALTER TABLE "DownstreamAdType" ADD CONSTRAINT "DownstreamAdType_downstreamId_fkey" FOREIGN KEY ("downstreamId") REFERENCES "Downstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownstreamAdType" ADD CONSTRAINT "DownstreamAdType_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upstream" ADD CONSTRAINT "Upstream_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpstreamAdType" ADD CONSTRAINT "UpstreamAdType_upstreamId_fkey" FOREIGN KEY ("upstreamId") REFERENCES "Upstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpstreamAdType" ADD CONSTRAINT "UpstreamAdType_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdOrder" ADD CONSTRAINT "AdOrder_upstreamId_fkey" FOREIGN KEY ("upstreamId") REFERENCES "Upstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdOrder" ADD CONSTRAINT "AdOrder_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSiteRebateRate" ADD CONSTRAINT "AdSiteRebateRate_adSiteId_fkey" FOREIGN KEY ("adSiteId") REFERENCES "AdSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSite" ADD CONSTRAINT "AdSite_upstreamId_fkey" FOREIGN KEY ("upstreamId") REFERENCES "Upstream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSite" ADD CONSTRAINT "AdSite_adOrderId_fkey" FOREIGN KEY ("adOrderId") REFERENCES "AdOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSiteEvent" ADD CONSTRAINT "AdSiteEvent_adSiteId_fkey" FOREIGN KEY ("adSiteId") REFERENCES "AdSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSiteDownstream" ADD CONSTRAINT "AdSiteDownstream_adSiteId_fkey" FOREIGN KEY ("adSiteId") REFERENCES "AdSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSiteDownstream" ADD CONSTRAINT "AdSiteDownstream_downstreamId_fkey" FOREIGN KEY ("downstreamId") REFERENCES "Downstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyInput" ADD CONSTRAINT "DailyInput_adSiteId_fkey" FOREIGN KEY ("adSiteId") REFERENCES "AdSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyInput" ADD CONSTRAINT "DailyInput_quarantineBatchId_fkey" FOREIGN KEY ("quarantineBatchId") REFERENCES "DailyInputQuarantineBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyInputQuarantineRecord" ADD CONSTRAINT "DailyInputQuarantineRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyInputQuarantineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyInputQuarantineRecord" ADD CONSTRAINT "DailyInputQuarantineRecord_dailyInputId_fkey" FOREIGN KEY ("dailyInputId") REFERENCES "DailyInput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownstreamPeriod" ADD CONSTRAINT "DownstreamPeriod_downstreamId_fkey" FOREIGN KEY ("downstreamId") REFERENCES "Downstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDownstreamRate" ADD CONSTRAINT "DailyDownstreamRate_downstreamId_fkey" FOREIGN KEY ("downstreamId") REFERENCES "Downstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

