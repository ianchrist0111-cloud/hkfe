import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateJwt, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { subscribeStrategySchema } from '../schemas';

const router = Router();

// GET /services
router.get('/', async (_req, res: Response) => {
  try {
    const services = await prisma.strategy.findMany({
      where: { isActive: true },
      include: { asset: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: services });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVICES_ERROR', message: err.message } });
  }
});

// GET /services/:id
router.get('/:id', async (req, res: Response) => {
  try {
    const service = await prisma.strategy.findUnique({
      where: { id: req.params.id },
      include: { asset: true },
    });

    if (!service) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });

    res.json({ success: true, data: service });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVICE_ERROR', message: err.message } });
  }
});

// POST /services/:id/subscribe
router.post('/:id/subscribe', authenticateJwt, validateBody(subscribeStrategySchema), async (req: AuthRequest, res: Response) => {
  try {
    const strategyId = req.params.id;
    const { allocatedUsd, config } = req.body;
    const userId = req.user!.id;

    const [strategy, wallet] = await Promise.all([
      prisma.strategy.findUnique({ where: { id: strategyId } }),
      prisma.simulatedWallet.findUnique({ where: { userId } }),
    ]);

    if (!strategy) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Strategy not found' } });
    if (!wallet) return res.status(404).json({ success: false, error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' } });

    if (wallet.availableBalance < allocatedUsd) {
      return res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient available funds to allocate to this service.' },
      });
    }

    const isEarn = strategy.strategyType === 'earn';
    const reservedField = isEarn ? 'reservedEarn' : 'reservedBots';

    const [sub, updatedWallet] = await prisma.$transaction([
      prisma.strategySubscription.create({
        data: {
          userId,
          strategyId,
          status: 'active',
          allocatedUsd,
          config: config ? JSON.stringify(config) : null,
          totalPnl: 0.0,
          accruedYield: 0.0,
        },
        include: { strategy: true },
      }),
      prisma.simulatedWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: wallet.availableBalance - allocatedUsd,
          [reservedField]: (wallet as any)[reservedField] + allocatedUsd,
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        eventType: 'STRATEGY_SUBSCRIBED',
        actorId: userId,
        actorRole: req.user!.role,
        targetEntityType: 'strategy_subscription',
        targetEntityId: sub.id,
        metadata: JSON.stringify({ strategyName: strategy.name, allocatedUsd }),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        subscription: sub,
        wallet: updatedWallet,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SUBSCRIBE_ERROR', message: err.message } });
  }
});

// GET /subscriptions
router.get('/user/active', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await prisma.strategySubscription.findMany({
      where: { userId: req.user!.id },
      include: { strategy: true },
      orderBy: { startedAt: 'desc' },
    });

    res.json({ success: true, data: subscriptions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SUBS_ERROR', message: err.message } });
  }
});

// DELETE /subscriptions/:id (Stop subscription)
router.delete('/user/:id', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const subId = req.params.id;
    const userId = req.user!.id;

    const sub = await prisma.strategySubscription.findFirst({
      where: { id: subId, userId },
      include: { strategy: true },
    });

    if (!sub) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } });

    const wallet = await prisma.simulatedWallet.findUnique({ where: { userId } });
    if (!wallet) return res.status(404).json({ success: false, error: { code: 'NO_WALLET', message: 'Wallet not found' } });

    const isEarn = sub.strategy.strategyType === 'earn';
    const reservedField = isEarn ? 'reservedEarn' : 'reservedBots';

    const [updatedSub, updatedWallet] = await prisma.$transaction([
      prisma.strategySubscription.update({
        where: { id: sub.id },
        data: {
          status: 'stopped',
          stoppedAt: new Date(),
        },
      }),
      prisma.simulatedWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: wallet.availableBalance + sub.allocatedUsd + sub.accruedYield + sub.totalPnl,
          [reservedField]: Math.max(0, (wallet as any)[reservedField] - sub.allocatedUsd),
          totalBalance: wallet.totalBalance + sub.accruedYield + sub.totalPnl,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        message: 'Subscription stopped successfully and funds returned to wallet.',
        subscription: updatedSub,
        wallet: updatedWallet,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'STOP_ERROR', message: err.message } });
  }
});

export default router;
