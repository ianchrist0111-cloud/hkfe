import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import prisma from '../prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Import the blacklist check dynamically to avoid circular dependency
let isTokenBlacklisted: ((token: string) => boolean) | null = null;
const getBlacklistChecker = async () => {
  if (!isTokenBlacklisted) {
    const authRoutes = await import('../routes/auth.routes');
    isTokenBlacklisted = authRoutes.isTokenBlacklisted;
  }
  return isTokenBlacklisted;
};

export const authenticateJwt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please provide a Bearer token.' },
    });
  }

  const token = authHeader.split(' ')[1];

  // ─── Check token blacklist ─────────────────────────────────
  try {
    const checker = await getBlacklistChecker();
    if (checker && checker(token)) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'This token has been revoked. Please log in again.' },
      });
    }
  } catch {
    // If blacklist check fails, continue (fail-open for availability)
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string; email: string; role: string };
    
    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, status: true },
    });

    // Active and inactive accounts can sign in and deposit. Closed accounts cannot.
    const canUseAccount = user && (user.status === 'active' || user.status === 'inactive' || user.status === 'suspended');
    if (!canUseAccount) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_INACTIVE', message: 'User account is closed or not found.' },
      });
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' },
    });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient privileges to access this resource.' },
      });
    }

    next();
  };
};
