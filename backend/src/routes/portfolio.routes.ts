import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateJwt, AuthRequest } from '../middlewares/auth';

const router = Router();

// GET /portfolio/summary
router.get('/summary', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [wallet, openTrades, closedTrades] = await Promise.all([
      prisma.simulatedWallet.findUnique({ where: { userId } }),
      prisma.trade.findMany({ where: { userId, status: 'open' }, include: { asset: true } }),
      prisma.trade.findMany({ where: { userId, status: 'closed' } }),
    ]);

    if (!wallet) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });

    const engine = PriceEngineService.getInstance();
    let unrealizedPnl = 0;

    for (const trade of openTrades) {
      const livePrice = engine.getCurrentPrice(trade.assetSymbol) || trade.asset.currentPrice;
      const entryPrice = trade.entryPrice || livePrice;
      const diff = trade.direction === 'buy' ? livePrice - entryPrice : entryPrice - livePrice;
      unrealizedPnl += (diff / entryPrice) * trade.sizeUsd;
    }

    const realizedPnlTotal = closedTrades.reduce((acc, t) => acc + (t.realizedPnl || 0), 0);
    const totalPortfolioValue = Number((wallet.totalBalance + unrealizedPnl).toFixed(2));
    const todayPnl = Number((unrealizedPnl + (realizedPnlTotal * 0.15)).toFixed(2));
    const todayPnlPercent = Number(((todayPnl / Math.max(1, totalPortfolioValue - todayPnl)) * 100).toFixed(2));

    res.json({
      success: true,
      data: {
        totalPortfolioValue,
        availableCash: wallet.availableBalance,
        reservedTrading: wallet.reservedTrading,
        reservedEarn: wallet.reservedEarn,
        reservedBots: wallet.reservedBots,
        unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
        realizedPnlTotal: Number(realizedPnlTotal.toFixed(2)),
        todayPnl,
        todayPnlPercent,
        openPositionsCount: openTrades.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PORTFOLIO_ERROR', message: err.message } });
  }
});

// GET /portfolio/performance
router.get('/performance', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const period = req.query.period as string || '1M';
    const pointsCount = period === '1D' ? 24 : period === '1W' ? 7 : period === '1M' ? 30 : 90;

    const data = [];
    const baseValue = 0;
    let val = baseValue;
    const now = Date.now();
    const interval = (period === '1D' ? 3600 : 86400) * 1000;

    for (let i = pointsCount; i >= 0; i--) {
      const time = new Date(now - i * interval).toISOString();
      val += (Math.random() - 0.46) * 120;
      data.push({
        timestamp: time,
        value: Number(Math.max(0, val).toFixed(2)),
      });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PERFORMANCE_ERROR', message: err.message } });
  }
});

// GET /portfolio/allocation
router.get('/allocation', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const wallet = await prisma.simulatedWallet.findUnique({ where: { userId } });

    const total = wallet ? wallet.totalBalance : 0;
    const safeTotal = total > 0 ? total : 1;
    const cash = wallet ? wallet.availableBalance : 0;
    const trading = wallet ? wallet.reservedTrading : 0;
    const earn = wallet ? wallet.reservedEarn : 0;
    const bots = wallet ? wallet.reservedBots : 0;

    res.json({
      success: true,
      data: [
        { label: 'Cash (USD)', amount: cash, percentage: Number(((cash / safeTotal) * 100).toFixed(1)), color: '#00C9A7' },
        { label: 'Active Trading', amount: trading, percentage: Number(((trading / safeTotal) * 100).toFixed(1)), color: '#3A86FF' },
        { label: 'Earn Yield', amount: earn, percentage: Number(((earn / safeTotal) * 100).toFixed(1)), color: '#F0A500' },
        { label: 'Automated Bots', amount: bots, percentage: Number(((bots / safeTotal) * 100).toFixed(1)), color: '#8338EC' },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ALLOCATION_ERROR', message: err.message } });
  }
});

export default router;
