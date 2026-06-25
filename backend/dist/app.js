"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const errorHandler_1 = require("./shared/errors/errorHandler");
const health_router_1 = require("./modules/health/health.router");
const auth_router_1 = require("./modules/auth/auth.router");
const user_router_1 = require("./modules/users/user.router");
const role_router_1 = require("./modules/roles/role.router");
const advertiser_router_1 = require("./modules/bff/advertisers/advertiser.router");
const media_router_1 = require("./modules/bff/media/media.router");
const adId_router_1 = require("./modules/bff/ad-ids/adId.router");
const mediaId_router_1 = require("./modules/bff/media-ids/mediaId.router");
const downstream_router_1 = require("./modules/bff/downstreams/downstream.router");
const dataEntry_router_1 = require("./modules/bff/data-entry/dataEntry.router");
const report_router_1 = require("./modules/bff/reports/report.router");
const settlement_router_1 = require("./modules/bff/settlement/settlement.router");
const quarantine_router_1 = require("./modules/bff/quarantine/quarantine.router");
const oplog_router_1 = require("./modules/bff/operation-logs/oplog.router");
const dashboard_router_1 = require("./modules/bff/dashboard/dashboard.router");
const adType_router_1 = require("./modules/bff/ad-types/adType.router");
const mediaAdOrder_router_1 = require("./modules/bff/media-ad-orders/mediaAdOrder.router");
const yiyi_router_1 = require("./modules/yiyi/yiyi.router");
const hardDelete_router_1 = require("./modules/bff/hard-delete/hardDelete.router");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({ origin: true, credentials: true }));
    app.use(express_1.default.json({ limit: '10mb' }));
    (0, health_router_1.healthRouter)(app);
    // Auth routes — under /api/auth (own router to keep /auth prefix)
    const authApi = express_1.default.Router();
    (0, auth_router_1.authRouter)(authApi);
    app.use('/api/auth', authApi);
    // User, role, permissions — under /api
    const api = express_1.default.Router();
    (0, user_router_1.userRouter)(api);
    (0, role_router_1.roleRouter)(api);
    (0, yiyi_router_1.yiyiRouter)(api);
    app.use('/api', api);
    // BFF routes — all under /api/bff
    const bff = express_1.default.Router();
    (0, advertiser_router_1.advertiserRouter)(bff);
    (0, media_router_1.mediaRouter)(bff);
    (0, adId_router_1.adIdRouter)(bff);
    (0, mediaId_router_1.mediaIdRouter)(bff);
    (0, downstream_router_1.downstreamRouter)(bff);
    (0, dataEntry_router_1.dataEntryRouter)(bff);
    (0, report_router_1.reportRouter)(bff);
    (0, settlement_router_1.settlementRouter)(bff);
    (0, quarantine_router_1.quarantineRouter)(bff);
    (0, oplog_router_1.oplogRouter)(bff);
    (0, dashboard_router_1.dashboardRouter)(bff);
    (0, adType_router_1.adTypeRouter)(bff);
    (0, mediaAdOrder_router_1.mediaAdOrderRouter)(bff);
    (0, hardDelete_router_1.hardDeleteRouter)(bff);
    app.use('/api/bff', bff);
    app.use(errorHandler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map