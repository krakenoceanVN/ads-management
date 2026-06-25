import type { Express } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config';
import { errorHandler } from './shared/errors/errorHandler';
import { healthRouter } from './modules/health/health.router';
import { authRouter } from './modules/auth/auth.router';
import { userRouter } from './modules/users/user.router';
import { roleRouter } from './modules/roles/role.router';
import { advertiserRouter } from './modules/bff/advertisers/advertiser.router';
import { mediaRouter } from './modules/bff/media/media.router';
import { adIdRouter } from './modules/bff/ad-ids/adId.router';
import { mediaIdRouter } from './modules/bff/media-ids/mediaId.router';
import { downstreamRouter } from './modules/bff/downstreams/downstream.router';
import { dataEntryRouter } from './modules/bff/data-entry/dataEntry.router';
import { reportRouter } from './modules/bff/reports/report.router';
import { settlementRouter } from './modules/bff/settlement/settlement.router';
import { quarantineRouter } from './modules/bff/quarantine/quarantine.router';
import { oplogRouter } from './modules/bff/operation-logs/oplog.router';
import { dashboardRouter } from './modules/bff/dashboard/dashboard.router';
import { adTypeRouter } from './modules/bff/ad-types/adType.router';
import { mediaAdOrderRouter } from './modules/bff/media-ad-orders/mediaAdOrder.router';
import { yiyiRouter } from './modules/yiyi/yiyi.router';
import { hardDeleteRouter } from './modules/bff/hard-delete/hardDelete.router';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  healthRouter(app);

  // Auth routes — under /api/auth (own router to keep /auth prefix)
  const authApi = express.Router();
  authRouter(authApi);
  app.use('/api/auth', authApi);

  // User, role, permissions — under /api
  const api = express.Router();
  userRouter(api);
  roleRouter(api);
  yiyiRouter(api);
  app.use('/api', api);

  // BFF routes — all under /api/bff
  const bff = express.Router();
  advertiserRouter(bff);
  mediaRouter(bff);
  adIdRouter(bff);
  mediaIdRouter(bff);
  downstreamRouter(bff);
  dataEntryRouter(bff);
  reportRouter(bff);
  settlementRouter(bff);
  quarantineRouter(bff);
  oplogRouter(bff);
  dashboardRouter(bff);
  adTypeRouter(bff);
  mediaAdOrderRouter(bff);
  hardDeleteRouter(bff);
  app.use('/api/bff', bff);

  app.use(errorHandler);

  return app;
}