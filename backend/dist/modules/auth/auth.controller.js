"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.me = me;
const auth_service_1 = require("./auth.service");
const success_1 = require("../../shared/response/success");
async function login(req, res) {
    const { username, password } = req.body;
    if (!username?.trim() || !password?.trim()) {
        res.status(400).json({ success: false, error: 'username and password are required', code: 'BAD_REQUEST' });
        return;
    }
    try {
        const result = await (0, auth_service_1.login)({ username, password });
        res.json((0, success_1.bffData)(result));
    }
    catch (err) {
        // Only expose known, safe authentication messages to the client.
        // Any other error (e.g. DB connection failure) must NOT leak internal
        // details such as file paths or database credentials — return a generic
        // message and log the real cause server-side.
        const SAFE_AUTH_MESSAGES = new Set(['Invalid credentials', 'Account is not active']);
        const rawMessage = err instanceof Error ? err.message : '';
        if (SAFE_AUTH_MESSAGES.has(rawMessage)) {
            res.status(401).json({ success: false, error: rawMessage, code: 'UNAUTHORIZED' });
            return;
        }
        console.error('[auth.login] Unexpected error during login:', err);
        res.status(500).json({
            success: false,
            error: 'An unexpected error occurred. Please try again later.',
            code: 'INTERNAL',
        });
    }
}
async function me(req, res) {
    // req.authUser is set by requireAuth middleware
    const authUser = req.authUser;
    if (!authUser) {
        res.status(401).json({ success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' });
        return;
    }
    res.json((0, success_1.bffData)(authUser));
}
//# sourceMappingURL=auth.controller.js.map