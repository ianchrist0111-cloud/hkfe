"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const router = (0, express_1.Router)();
// GET /health
router.get('/', async (_req, res) => {
    const startTime = Date.now();
    let dbStatus = 'connected';
    let dbLatencyMs = 0;
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
        dbLatencyMs = Date.now() - startTime;
    }
    catch {
        dbStatus = 'disconnected';
    }
    const mem = process.memoryUsage();
    res.json({
        status: dbStatus === 'connected' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        service: 'hkfes-trading-backend',
        version: '1.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
            status: dbStatus,
            latencyMs: dbLatencyMs,
        },
        system: {
            nodeVersion: process.version,
            memory: {
                rssMb: +(mem.rss / (1024 * 1024)).toFixed(2),
                heapUsedMb: +(mem.heapUsed / (1024 * 1024)).toFixed(2),
                heapTotalMb: +(mem.heapTotal / (1024 * 1024)).toFixed(2),
            },
        },
    });
});
// GET /health/ready
router.get('/ready', async (_req, res) => {
    try {
        const start = Date.now();
        await prisma_1.default.$queryRaw `SELECT 1`;
        const latency = Date.now() - start;
        res.json({
            status: 'ready',
            database: 'connected',
            latencyMs: latency,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        res.status(503).json({
            status: 'not_ready',
            database: 'disconnected',
            error: err.message,
        });
    }
});
exports.default = router;
