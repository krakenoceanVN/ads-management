"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
async function main() {
    const app = (0, app_1.createApp)();
    app.listen(config_1.config.port, () => {
        console.log(`[server] listening on port ${config_1.config.port} (${config_1.config.nodeEnv})`);
    });
}
main().catch((err) => {
    console.error('[server] Failed to start:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map