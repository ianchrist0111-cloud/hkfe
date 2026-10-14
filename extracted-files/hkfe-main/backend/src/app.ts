import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler';

import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import kycRoutes from './routes/kyc.routes';
import walletRoutes from './routes/wallet.routes';
import marketRoutes from './routes/market.routes';
import tradingRoutes from './routes/trading.routes';
import portfolioRoutes from './routes/portfolio.routes';
import servicesRoutes from './routes/services.routes';
import notificationsRoutes from './routes/notifications.routes';
import adminRoutes from './routes/admin.routes';
import healthRoutes from './routes/health.routes';
import cryptoRoutes from './routes/crypto.routes';
import supportRoutes from './routes/support.routes';
import platformRoutes from './routes/platform.routes';

export const createApp = () => {
  const app = express();

  // ─── Response Time Profiling ──────────────────────────────
  app.use((_req, res, next) => {
    const start = process.hrtime();
    const writeHead = res.writeHead;
    res.writeHead = function (...args: any[]) {
      const diff = process.hrtime(start);
      const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
      res.setHeader('X-Response-Time', `${timeInMs}ms`);
      return writeHead.apply(this, args as any);
    };
    next();
  });

  // ─── Security Headers ──────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // ─── CORS — Locked to configured origin ────────────────────
  const allowedOrigins = ENV.CORS_ORIGIN.split(',').map(o => o.trim());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, Postman, curl)
      if (!origin) return callback(null, true);
      const isDev = ENV.NODE_ENV !== 'production';
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
  const globalLimiter = rateLimit({
    windowMs: ENV.RATE_LIMIT_API_WINDOW_MS,
    max: ENV.RATE_LIMIT_API_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => ENV.NODE_ENV === 'test',
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    },
  });
  app.use('/api/', globalLimiter);

  // ─── Auth Rate Limiter (stricter) ──────────────────────────
  const authLimiter = rateLimit({
    windowMs: ENV.RATE_LIMIT_AUTH_WINDOW_MS,
    max: ENV.RATE_LIMIT_AUTH_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => ENV.NODE_ENV === 'test',
    message: {
      success: false,
      error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts. Please wait before trying again.' },
    },
  });
  app.use('/api/v1/auth', authLimiter);

  // ─── Body parsers ─────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Health checks ───────────────────────────────────────
  app.use('/health', healthRoutes);
  app.use('/api/v1/health', healthRoutes);

  // ─── API v1 routes ────────────────────────────────────────
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/kyc', kycRoutes);
  app.use('/api/v1/wallet', walletRoutes);
  app.use('/api/v1/market', marketRoutes);
  app.use('/api/v1/trading', tradingRoutes);
  app.use('/api/v1/portfolio', portfolioRoutes);
  app.use('/api/v1/services', servicesRoutes);
  app.use('/api/v1/subscriptions', servicesRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/crypto', cryptoRoutes);
  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/platform', platformRoutes);

  // ─── Frontend Static Assets Serving (Single Container Production) ───
  const candidateFrontendDirs = [
    path.resolve(process.cwd(), 'public-web'),
    path.resolve(__dirname, '../../public-web'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(__dirname, '../../../frontend/dist'),
  ];
  const frontendDistPath = candidateFrontendDirs.find(dir => fs.existsSync(path.join(dir, 'index.html')));

  if (frontendDistPath) {
    // Serve static files from the built frontend dist
    app.use(express.static(frontendDistPath));

    // For any non-API, non-WebSocket GET request, serve index.html for client-side routing
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  } else {
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
  app.use(errorHandler);

  return app;
};

export default createApp;
