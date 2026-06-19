import { createApp } from './app';
import { config } from './config';

async function main() {
  const app = createApp();

  app.set('trust proxy', 1);   // 👈 thêm dòng này


  app.listen(config.port, () => {
    console.log(`[server] listening on port ${config.port} (${config.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});