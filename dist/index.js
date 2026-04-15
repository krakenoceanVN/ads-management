"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = require("dotenv");
const prisma_js_1 = __importDefault(require("./prisma.js"));
const dailyInput_js_1 = __importDefault(require("./routes/dailyInput.js"));
const dashboard_js_1 = __importDefault(require("./routes/dashboard.js"));
const admin_js_1 = __importDefault(require("./routes/admin.js"));
const yiyiData_js_1 = __importDefault(require("./routes/yiyiData.js"));
const leDashboard_js_1 = __importDefault(require("./routes/leDashboard.js"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || origin.startsWith('http://localhost:')) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
// Attach prisma to every request
app.use((req, _res, next) => {
    req.prisma = prisma_js_1.default;
    next();
});
// Routes
app.use('/api/daily-input', dailyInput_js_1.default);
app.use('/api/dashboard', dashboard_js_1.default);
app.use('/api/dashboard', leDashboard_js_1.default);
app.use('/api', admin_js_1.default);
app.use('/api', yiyiData_js_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
