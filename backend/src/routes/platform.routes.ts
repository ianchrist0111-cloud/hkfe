import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateJwt, requireRole, AuthRequest } from '../middlewares/auth';

const router = Router();

// Helper to get or create the singleton platform config
export const getPlatformConfig = async () => {
  let config = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
  if (!config) {
    config = await prisma.platformConfig.create({
      data: {
        id: 'default',
        paymentsEnabled: false,
        telegramEnabled: false,
        telegramHandle: '',
        telegramNumber: '',
        telegramUrl: '',
      },
    });
  }
  return config;
};

// ─────────────────────────────────────────────────────────────
// 1. PUBLIC / CLIENT ENDPOINTS
// ─────────────────────────────────────────────────────────────

// GET /api/v1/platform/config — Publicly accessible platform settings (Telegram & Payment availability)
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await getPlatformConfig();
    const handle = config.telegramHandle?.trim() || '';
    const number = config.telegramNumber?.trim() || '';
    let resolvedUrl = config.telegramUrl?.trim() || '';

    if (!resolvedUrl) {
      if (handle) {
        resolvedUrl = `https://t.me/${handle.replace(/^@/, '')}`;
      } else if (number) {
        resolvedUrl = `https://t.me/${number.replace(/[^0-9+]/g, '')}`;
      }
    }

    res.json({
      success: true,
      data: {
        paymentsEnabled: config.paymentsEnabled,
        telegramEnabled: config.telegramEnabled,
        telegramHandle: handle,
        telegramNumber: number,
        telegramUrl: resolvedUrl,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'PLATFORM_CONFIG_ERROR', message: err.message },
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. SUPER ADMIN PROTECTED ENDPOINTS
// ─────────────────────────────────────────────────────────────

// All routes below require super_admin role
router.use(authenticateJwt);
router.use(requireRole(['super_admin']));

// GET /api/v1/platform/admin/settings — Full settings for Super Admin
router.get('/admin/settings', async (_req: AuthRequest, res: Response) => {
  try {
    const config = await getPlatformConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_FETCH_ERROR', message: err.message },
    });
  }
});

// PUT /api/v1/platform/admin/settings — Super Admin updates platform toggles & Telegram info
router.put('/admin/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { paymentsEnabled, telegramEnabled, telegramHandle, telegramNumber, telegramUrl } = req.body;

    let resolvedUrl = typeof telegramUrl === 'string' ? telegramUrl.trim() : '';
    const cleanHandle = typeof telegramHandle === 'string' ? telegramHandle.trim() : '';
    const cleanNumber = typeof telegramNumber === 'string' ? telegramNumber.trim() : '';

    if (!resolvedUrl) {
      if (cleanHandle) {
        resolvedUrl = `https://t.me/${cleanHandle.replace(/^@/, '')}`;
      } else if (cleanNumber) {
        resolvedUrl = `https://t.me/${cleanNumber.replace(/[^0-9+]/g, '')}`;
      }
    }

    const updated = await prisma.platformConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(typeof paymentsEnabled === 'boolean' && { paymentsEnabled }),
        ...(typeof telegramEnabled === 'boolean' && { telegramEnabled }),
        ...(typeof telegramHandle === 'string' && { telegramHandle: cleanHandle }),
        ...(typeof telegramNumber === 'string' && { telegramNumber: cleanNumber }),
        telegramUrl: resolvedUrl,
      },
      create: {
        id: 'default',
        paymentsEnabled: Boolean(paymentsEnabled),
        telegramEnabled: Boolean(telegramEnabled),
        telegramHandle: cleanHandle,
        telegramNumber: cleanNumber,
        telegramUrl: resolvedUrl,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        eventType: 'SUPER_ADMIN_PLATFORM_SETTINGS_UPDATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntityType: 'PlatformConfig',
        targetEntityId: 'default',
        metadata: JSON.stringify({
          paymentsEnabled: updated.paymentsEnabled,
          telegramEnabled: updated.telegramEnabled,
          telegramHandle: updated.telegramHandle,
          telegramNumber: updated.telegramNumber,
        }),
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Platform configuration updated and published successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_UPDATE_ERROR', message: err.message },
    });
  }
});

// GET /api/v1/platform/admin/deposit-wallets — List all deposit methods (including inactive)
router.get('/admin/deposit-wallets', async (_req: AuthRequest, res: Response) => {
  try {
    const wallets = await prisma.platformDepositWallet.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: wallets });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WALLETS_FETCH_ERROR', message: err.message },
    });
  }
});

// POST /api/v1/platform/admin/deposit-wallets — Create & publish new deposit method
router.post('/admin/deposit-wallets', async (req: AuthRequest, res: Response) => {
  try {
    const { asset, network, address, memoOrTag, qrCodeUrl, minDeposit, details, isActive } = req.body;

    if (!asset || !network || !address) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Asset, network, and wallet address are required.' },
      });
    }

    const cleanAsset = asset.trim().toUpperCase();
    const cleanNetwork = network.trim();
    const cleanAddress = address.trim();

    // Check for duplicate address
    const existing = await prisma.platformDepositWallet.findUnique({
      where: { address: cleanAddress },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_WALLET', message: 'A wallet with this address already exists.' },
      });
    }

    const wallet = await prisma.platformDepositWallet.create({
      data: {
        asset: cleanAsset,
        network: cleanNetwork,
        address: cleanAddress,
        memoOrTag: memoOrTag ? String(memoOrTag).trim() : null,
        qrCodeUrl: qrCodeUrl ? String(qrCodeUrl).trim() : null,
        minDeposit: typeof minDeposit === 'number' && minDeposit >= 0 ? minDeposit : 10.0,
        details: details ? String(details).trim() : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'SUPER_ADMIN_DEPOSIT_WALLET_CREATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntityType: 'PlatformDepositWallet',
        targetEntityId: wallet.id,
        metadata: JSON.stringify({
          asset: wallet.asset,
          network: wallet.network,
          address: wallet.address,
        }),
      },
    });

    res.status(201).json({
      success: true,
      data: wallet,
      message: 'Deposit method created and published successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WALLET_CREATE_ERROR', message: err.message },
    });
  }
});

// PUT /api/v1/platform/admin/deposit-wallets/:id — Update existing deposit method
router.put('/admin/deposit-wallets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { asset, network, address, memoOrTag, qrCodeUrl, minDeposit, details, isActive } = req.body;

    const existing = await prisma.platformDepositWallet.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'WALLET_NOT_FOUND', message: 'Deposit wallet method not found.' },
      });
    }

    const cleanAddress = address ? address.trim() : existing.address;
    if (cleanAddress !== existing.address) {
      const duplicate = await prisma.platformDepositWallet.findUnique({
        where: { address: cleanAddress },
      });
      if (duplicate && duplicate.id !== id) {
        return res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE_WALLET', message: 'Another wallet with this address already exists.' },
        });
      }
    }

    const updated = await prisma.platformDepositWallet.update({
      where: { id },
      data: {
        ...(asset && { asset: asset.trim().toUpperCase() }),
        ...(network && { network: network.trim() }),
        ...(address && { address: cleanAddress }),
        memoOrTag: memoOrTag !== undefined ? (memoOrTag ? String(memoOrTag).trim() : null) : existing.memoOrTag,
        qrCodeUrl: qrCodeUrl !== undefined ? (qrCodeUrl ? String(qrCodeUrl).trim() : null) : existing.qrCodeUrl,
        ...(typeof minDeposit === 'number' && { minDeposit }),
        details: details !== undefined ? (details ? String(details).trim() : null) : existing.details,
        ...(typeof isActive === 'boolean' && { isActive }),
      },
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'SUPER_ADMIN_DEPOSIT_WALLET_UPDATED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntityType: 'PlatformDepositWallet',
        targetEntityId: updated.id,
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Deposit method updated successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WALLET_UPDATE_ERROR', message: err.message },
    });
  }
});

// PATCH /api/v1/platform/admin/deposit-wallets/:id/toggle — Quick toggle active state
router.patch('/admin/deposit-wallets/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.platformDepositWallet.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'WALLET_NOT_FOUND', message: 'Deposit wallet method not found.' },
      });
    }

    const updated = await prisma.platformDepositWallet.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    res.json({
      success: true,
      data: updated,
      message: `Deposit method ${updated.isActive ? 'activated' : 'deactivated'} successfully.`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WALLET_TOGGLE_ERROR', message: err.message },
    });
  }
});

// DELETE /api/v1/platform/admin/deposit-wallets/:id — Remove deposit method
router.delete('/admin/deposit-wallets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.platformDepositWallet.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'WALLET_NOT_FOUND', message: 'Deposit wallet method not found.' },
      });
    }

    await prisma.platformDepositWallet.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        eventType: 'SUPER_ADMIN_DEPOSIT_WALLET_DELETED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntityType: 'PlatformDepositWallet',
        targetEntityId: id,
        metadata: JSON.stringify({ asset: existing.asset, network: existing.network, address: existing.address }),
      },
    });

    res.json({
      success: true,
      message: 'Deposit method removed successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'WALLET_DELETE_ERROR', message: err.message },
    });
  }
});

export default router;
