import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import prisma from '../prisma';
import { ENV } from '../config/env';
import { validateBody } from '../middlewares/validate';
import { registerSchema, loginSchema, mfaVerifySchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, sendOtpSchema, verifyOtpSchema } from '../schemas';
import { authenticateJwt, AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import { sendOtpEmail, sendEmail, sendPasswordResetEmail } from '../services/emailService';

const router = Router();

// ─── In-Memory Token Blacklist ───────────────────────────────
// For production: replace with Redis SET with TTL matching token expiry
const tokenBlacklist = new Set<string>();

// ─── In-Memory Password Reset Tokens ─────────────────────────
// Maps token -> { userId: string, expiresAt: number }
const passwordResetTokens = new Map<string, { userId: string; expiresAt: number }>();

// ─── In-Memory Email Verification Codes ──────────────────────
// Maps userId -> { code: string; email: string; expiresAt: number }
const emailVerificationCodes = new Map<string, { code: string; email: string; expiresAt: number }>();

// ─── In-Memory Email OTP Codes ───────────────────────────────
// Maps email -> { code: string; purpose: string; expiresAt: number; attempts: number }
const emailOtpCodes = new Map<string, { code: string; purpose: string; expiresAt: number; attempts: number }>();

export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

// Clean up expired tokens every hour (prevent memory leak)
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const token of tokenBlacklist) {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      if (decoded?.exp && decoded.exp < now) {
        tokenBlacklist.delete(token);
      }
    } catch {
      tokenBlacklist.delete(token);
    }
  }
}, 3600000).unref();

// ─── Helper: Extract client IP ──────────────────────────────
function getClientIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || req.ip
    || 'unknown';
}

// POST /auth/register
router.post('/register', validateBody(registerSchema), async (req, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_IN_USE', message: 'An account with this email address already exists.' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'user',
        status: 'active',
        kycStatus: 'not_started',
        emailVerified: false,
        wallet: {
          create: {
            totalBalance: 0.0,
            availableBalance: 0.0,
            reservedTrading: 0.0,
            reservedEarn: 0.0,
            reservedBots: 0.0,
            currency: 'USD',
          },
        },
      },
      include: { wallet: true },
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'USER_REGISTERED',
        actorId: user.id,
        actorRole: user.role,
        targetEntityType: 'user',
        targetEntityId: user.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        metadata: JSON.stringify({ email: user.email }),
      },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    emailOtpCodes.set(normalizedEmail, {
      code,
      purpose: 'verification',
      expiresAt,
      attempts: 1,
    });

    const emailSent = await sendOtpEmail({ to: normalizedEmail, otp: code, purpose: 'verification' });
    if (!emailSent) {
      logger.warn(`[EmailVerification] Registration OTP send failed for ${normalizedEmail}`);
    }

    res.status(201).json({
      success: true,
      data: {
        message: 'Account created. Please verify your email address with the code sent to your inbox to complete signup.',
        email: normalizedEmail,
        emailVerified: false,
        devCode: ENV.NODE_ENV !== 'production' ? code : undefined,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'REGISTER_ERROR', message: err.message } });
  }
});

// POST /auth/login
router.post('/login', validateBody(loginSchema), async (req, res: Response) => {
  try {
    const { email, password } = req.body;
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { wallet: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address before logging in.' },
      });
    }

    // ─── Account lockout check ───────────────────────────────
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account is temporarily locked due to too many failed login attempts. Try again in ${remainingMin} minute(s).`,
        },
      });
    }

    if (user.status !== 'active' && user.status !== 'inactive' && user.status !== 'suspended') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_CLOSED', message: 'This account is closed.' },
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      const newFailedCount = user.failedLoginCount + 1;
      const lockoutData: any = { failedLoginCount: newFailedCount };

      if (newFailedCount >= ENV.MAX_FAILED_LOGIN_ATTEMPTS) {
        lockoutData.lockedUntil = new Date(Date.now() + ENV.ACCOUNT_LOCKOUT_MINUTES * 60000);
        await prisma.auditLog.create({
          data: {
            eventType: 'ACCOUNT_LOCKED',
            actorId: user.id,
            actorRole: user.role,
            targetEntityType: 'user',
            targetEntityId: user.id,
            ipAddress: clientIp,
            userAgent,
            metadata: JSON.stringify({ failedAttempts: newFailedCount, lockedUntil: lockoutData.lockedUntil }),
          },
        });
      }

      await prisma.user.update({ where: { id: user.id }, data: lockoutData });

      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    if (user.mfaEnabled) {
      return res.json({
        success: true,
        data: {
          requiresMfa: true,
          email: user.email,
          message: 'Please provide your 6-digit authenticator code to complete login.',
        },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: clientIp },
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'LOGIN_SUCCESS',
        actorId: user.id,
        actorRole: user.role,
        targetEntityType: 'user',
        targetEntityId: user.id,
        ipAddress: clientIp,
        userAgent,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      ENV.JWT_SECRET,
      { expiresIn: '7d', jwtid: crypto.randomUUID() }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          kycStatus: user.kycStatus,
          tradingBlocked: user.tradingBlocked ?? false,
          withdrawalsBlocked: user.withdrawalsBlocked ?? false,
          depositsBlocked: user.depositsBlocked ?? false,
          emailVerified: user.emailVerified,
          wallet: user.wallet,
        },
        token,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'LOGIN_ERROR', message: err.message } });
  }
});

export default router;

// The rest of the file remains unchanged below this point.
