"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const app_1 = require("./app");
const env_1 = require("./config/env");
const priceEngineService_1 = __importDefault(require("./services/priceEngineService"));
const prisma_1 = __importDefault(require("./prisma"));
const logger_1 = __importDefault(require("./utils/logger"));
async function bootstrap() {
    const app = (0, app_1.createApp)();
    const server = http_1.default.createServer(app);
    // Attach WebSocket server
    const wss = new ws_1.WebSocketServer({ server, path: '/ws/prices' });
    // WebSocket Heartbeat (Ping/Pong) to drop dead client connections
    const heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    wss.on('connection', (ws) => {
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });
    });
    // Initialize simulated price engine
    try {
        await priceEngineService_1.default.getInstance().initialize(wss);
    }
    catch (err) {
        console.warn('[Warning] PriceEngine initialization deferred until database is migrated/seeded:', err.message);
    }
    server.listen(env_1.ENV.PORT, '0.0.0.0', () => {
        console.log(`====================================================`);
        console.log(`🚀 HKFES Backend API Server listening on port ${env_1.ENV.PORT}`);
        console.log(`📡 WebSocket Price Stream live on ws://localhost:${env_1.ENV.PORT}/ws/prices`);
        console.log(`🩺 Health check: http://localhost:${env_1.ENV.PORT}/api/v1/health`);
        console.log(`====================================================`);
    });
    // Graceful shutdown
    const shutdown = async () => {
        logger_1.default.info('Shutting down HKFES backend gracefully...');
        clearInterval(heartbeatInterval);
        wss.clients.forEach(client => {
            try {
                client.close(1001, 'Server shutting down');
            }
            catch { }
        });
        server.close();
        await prisma_1.default.$disconnect();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
bootstrap().catch((err) => {
    console.error('Failed to start HKFES backend server:', err);
    process.exit(1);
});
