import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { authenticateJwt, AuthRequest } from '../middlewares/auth';

const router = Router();

// GET /users/me
router.get('/me', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        wallet: true,
        kycRecord: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        kycStatus: user.kycStatus,
        tradingBlocked: user.tradingBlocked ?? false,
        withdrawalsBlocked: user.withdrawalsBlocked ?? false,
        depositsBlocked: user.depositsBlocked ?? false,
        mfaEnabled: user.mfaEnabled,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        wallet: user.wallet,
        kycRecord: user.kycRecord,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /users/me
router.patch('/me', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phoneNumber !== undefined && { phoneNumber }),
      },
      select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: err.message } });
  }
});

// PATCH /users/me/password
router.patch('/me/password', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 8 characters long.' },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Current password does not match.' } });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ success: true, data: { message: 'Password updated successfully.' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PASSWORD_ERROR', message: err.message } });
  }
});

// POST /users/me/push-subscription
router.post('/me/push-subscription', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, p256dh, auth, platform } = req.body;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing push subscription fields.' } });
    }

    const sub = await prisma.pushSubscription.create({
      data: {
        userId: req.user!.id,
        endpoint,
        p256dh,
        auth,
        platform: platform || 'desktop',
      },
    });

    res.json({ success: true, data: sub });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PUSH_ERROR', message: err.message } });
  }
});

export default router;
