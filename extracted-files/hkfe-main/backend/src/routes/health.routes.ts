import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /health
router.get('/', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let dbStatus = 'connected';
  let dbLatencyMs = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startTime;
  } catch {
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
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    res.json({
      status: 'ready',
      database: 'connected',
      latencyMs: latency,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err.message,
    });
  }
});

export default router;

