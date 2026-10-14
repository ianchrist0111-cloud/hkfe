import http from 'http';
import { WebSocketServer } from 'ws';
import { createApp } from './app';
import { ENV } from './config/env';
import PriceEngineService from './services/priceEngineService';
import prisma from './prisma';
import logger from './utils/logger';


async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Attach WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws/prices' });

  // WebSocket Heartbeat (Ping/Pong) to drop dead client connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('connection', (ws: any) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Initialize simulated price engine
  try {
    await PriceEngineService.getInstance().initialize(wss);
  } catch (err) {
    console.warn('[Warning] PriceEngine initialization deferred until database is migrated/seeded:', (err as Error).message);
  }

  server.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 HKFES Backend API Server listening on port ${ENV.PORT}`);
    console.log(`📡 WebSocket Price Stream live on ws://localhost:${ENV.PORT}/ws/prices`);
    console.log(`🩺 Health check: http://localhost:${ENV.PORT}/api/v1/health`);
    console.log(`====================================================`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down HKFES backend gracefully...');
    clearInterval(heartbeatInterval);
    wss.clients.forEach(client => {
      try {
        client.close(1001, 'Server shutting down');
      } catch {}
    });
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

}

bootstrap().catch((err) => {
  console.error('Failed to start HKFES backend server:', err);
  process.exit(1);
});
