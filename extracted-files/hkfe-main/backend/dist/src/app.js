"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middlewares/errorHandler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const kyc_routes_1 = __importDefault(require("./routes/kyc.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const market_routes_1 = __importDefault(require("./routes/market.routes"));
const trading_routes_1 = __importDefault(require("./routes/trading.routes"));
const portfolio_routes_1 = __importDefault(require("./routes/portfolio.routes"));
const services_routes_1 = __importDefault(require("./routes/services.routes"));
const notifications_routes_1 = __importDefault(require("./routes/notifications.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const crypto_routes_1 = __importDefault(require("./routes/crypto.routes"));
const support_routes_1 = __importDefault(require("./routes/support.routes"));
const platform_routes_1 = __importDefault(require("./routes/platform.routes"));
const createApp = () => {
    const app = (0, express_1.default)();
    // ─── Response Time Profiling ──────────────────────────────
    app.use((_req, res, next) => {
        const start = process.hrtime();
        const writeHead = res.writeHead;
        res.writeHead = function (...args) {
            const diff = process.hrtime(start);
            const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
            res.setHeader('X-Response-Time', `${timeInMs}ms`);
            return writeHead.apply(this, args);
        };
        next();
    });
    // ─── Security Headers ──────────────────────────────────────
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    }));
    // ─── CORS — Locked to configured origin ────────────────────
    const allowedOrigins = env_1.ENV.CORS_ORIGIN.split(',').map(o => o.trim());
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Allow requests with no origin (server-to-server, Postman, curl)
            if (!origin)
                return callback(null, true);
            const isDev = env_1.ENV.NODE_ENV !== 'production';
            const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
            // Also allow IP addresses in development
            const isIpAddress = /^http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(origin);
            if (allowedOrigins.includes('*') || allowedOrigins.includes(origin) || (isDev && (isLocalhost || isIpAddress))) {
                return callback(null, true);
            }
            callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    // ─── Global Rate Limiter ───────────────────────────────────
    const globalLimiter = (0, express_rate_limit_1.default)({
        windowMs: env_1.ENV.RATE_LIMIT_API_WINDOW_MS,
        max: env_1.ENV.RATE_LIMIT_API_MAX,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => env_1.ENV.NODE_ENV === 'test',
        message: {
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
        },
    });
    app.use('/api/', globalLimiter);
    // ─── Auth Rate Limiter (stricter) ──────────────────────────
    const authLimiter = (0, express_rate_limit_1.default)({
        windowMs: env_1.ENV.RATE_LIMIT_AUTH_WINDOW_MS,
        max: env_1.ENV.RATE_LIMIT_AUTH_MAX,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => env_1.ENV.NODE_ENV === 'test',
        message: {
            success: false,
            error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts. Please wait before trying again.' },
        },
    });
    app.use('/api/v1/auth', authLimiter);
    // ─── Body parsers ─────────────────────────────────────────
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // ─── Health checks ───────────────────────────────────────
    app.use('/health', health_routes_1.default);
    app.use('/api/v1/health', health_routes_1.default);
    // ─── API v1 routes ────────────────────────────────────────
    app.use('/api/v1/auth', auth_routes_1.default);
    app.use('/api/v1/users', users_routes_1.default);
    app.use('/api/v1/kyc', kyc_routes_1.default);
    app.use('/api/v1/wallet', wallet_routes_1.default);
    app.use('/api/v1/market', market_routes_1.default);
    app.use('/api/v1/trading', trading_routes_1.default);
    app.use('/api/v1/portfolio', portfolio_routes_1.default);
    app.use('/api/v1/services', services_routes_1.default);
    app.use('/api/v1/subscriptions', services_routes_1.default);
    app.use('/api/v1/notifications', notifications_routes_1.default);
    app.use('/api/v1/admin', admin_routes_1.default);
    app.use('/api/v1/crypto', crypto_routes_1.default);
    app.use('/api/v1/support', support_routes_1.default);
    app.use('/api/v1/platform', platform_routes_1.default);
    // ─── Frontend Static Assets Serving (Single Container Production) ───
    const candidateFrontendDirs = [
        path_1.default.resolve(process.cwd(), 'public-web'),
        path_1.default.resolve(__dirname, '../../public-web'),
        path_1.default.resolve(process.cwd(), '../frontend/dist'),
        path_1.default.resolve(__dirname, '../../../frontend/dist'),
    ];
    const frontendDistPath = candidateFrontendDirs.find(dir => fs_1.default.existsSync(path_1.default.join(dir, 'index.html')));
    if (frontendDistPath) {
        // Serve static files from the built frontend dist
        app.use(express_1.default.static(frontendDistPath));
        // For any non-API, non-WebSocket GET request, serve index.html for client-side routing
        app.get('*', (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
                return next();
            }
            res.sendFile(path_1.default.join(frontendDistPath, 'index.html'));
        });
    }
    else {
        // Root welcome when running standalone API without frontend bundle
        app.get('/', (_req, res) => {
            res.json({
                name: 'HKFES Professional Trading Platform API',
                version: '1.0.0',
                status: 'operational',
                docs: '/api/v1/health',
            });
        });
    }
    // 404 handler for unmatched API routes
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found.` },
        });
    });
    // Global Error Handler
    app.use(errorHandler_1.errorHandler);
    return app;
};
exports.createApp = createApp;
exports.default = exports.createApp;
