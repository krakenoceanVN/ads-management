/**
 * BFF Routes Index
 * Registers all BFF (Backend For Frontend) adapters
 */

import { Router } from "express";
import advertiserController from "../../controllers/bff/advertiser.controller.js";
import mediaController from "../../controllers/bff/media.controller.js";
import adOrderController from "../../controllers/bff/adOrder.controller.js";
import adIdController from "../../controllers/bff/adId.controller.js";
import mediaIdController from "../../controllers/bff/mediaId.controller.js";
import downstreamController from "../../controllers/bff/downstream.controller.js";
import advertiserDataEntryController from "../../controllers/bff/advertiserDataEntry.controller.js";
import mediaDataEntryController from "../../controllers/bff/mediaDataEntry.controller.js";
import reportController from "../../controllers/bff/report.controller.js";
import settlementController from "../../controllers/bff/settlement.controller.js";
import operationLogController from "../../controllers/bff/operationLog.controller.js";

const router = Router();

// Advertiser routes (Frontend → Upstream)
router.use("/advertisers", advertiserController);

// Media routes (Frontend → AdSite)
router.use("/media", mediaController);

// AdOrder routes (VIRTUAL/READ-ONLY - derived from AdType)
router.use("/ad-orders", adOrderController);

// AdId routes (Frontend → AdSite, demand side)
router.use("/ad-ids", adIdController);

// MediaId routes (Frontend → AdSite + Downstream, supply side)
router.use("/media-ids", mediaIdController);

// Downstream routes (Frontend → Downstream, read-only lookup)
router.use("/downstreams", downstreamController);

// DataEntry - Advertiser (Frontend → DailyInput, advertiser side)
router.use("/data-entry/advertisers", advertiserDataEntryController);

// DataEntry - Media (Frontend → DailyInput, media side)
router.use("/data-entry/media", mediaDataEntryController);

// Report routes - GET /api/bff/reports/*
router.use("/reports", reportController);

// Settlement routes - GET /api/bff/settlement/*
router.use("/settlement", settlementController);

// Operation Logs routes
router.use("/operation-logs", operationLogController);

export default router;