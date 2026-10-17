import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateJwt, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { placeOrderSchema, closePositionSchema, placeShortTermOptionSchema, settleShortTermOptionSchema } from '../schemas';
import PriceEngineService from '../services/priceEngineService';

const router = Router();

// POST /trading/orders (Place simulated order)
router.post('/orders', authenticateJwt, validateBody(placeOrderSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { symbol, direction, orderType, sizeUsd, limitPrice, stopLoss, takeProfit } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, tradingBlocked: true },
    });

    if (!user || user.status === 'suspended' || user.tradingBlocked) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TRADING_DISALLOWED',
          message: user?.status === 'suspended'
            ? 'Account is suspended. Order execution is disabled.'
            : 'Trading privileges are temporarily disabled for your account by Compliance.',
        },
      });
    }

    let wallet = await prisma.simulatedWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.simulatedWallet.create({
        data: {
          userId,
          totalBalance: 0.0,
          availableBalance: 0.0,
          reservedTrading: 0.0,
          reservedEarn: 0.0,
          reservedBots: 0.0,
          currency: 'USD',
        },
      });
    }

    let asset = await prisma.asset.findUnique({ where: { symbol } });
    if (!asset) {
      const liveP = PriceEngineService.getInstance().getCurrentPrice(symbol) || 100.0;
      asset = await prisma.asset.create({
        data: {
          symbol,
          displayName: symbol,
          assetClass: symbol.startsWith('XAU') || symbol.startsWith('XAG') || symbol.startsWith('WTI') || symbol.startsWith('BRENT') || symbol.startsWith('NG')
            ? 'commodity'
            : symbol.includes('/')
            ? (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL') || symbol.includes('BNB') || symbol.includes('XRP') || symbol.includes('DOGE') || symbol.includes('ADA') || symbol.includes('AVAX') || symbol.includes('DOT') || symbol.includes('LINK') || symbol.includes('NEAR') || symbol.includes('SUI') ? 'crypto' : 'fx')
            : (symbol === 'SPX500' || symbol === 'NAS100' || symbol === 'US30' || symbol === 'GER40' ? 'index' : 'equity'),
          seedPrice: liveP,
          currentPrice: liveP,
        },
      });
    }

    if (wallet.availableBalance < sizeUsd) {
      return res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient available balance to place order.' },
      });
    }

    const currentPrice = PriceEngineService.getInstance().getCurrentPrice(symbol) || asset.currentPrice;
    const isMarket = orderType === 'market';
    const entryPrice = isMarket ? currentPrice : limitPrice || currentPrice;
    const units = Number((sizeUsd / entryPrice).toFixed(6));

    await prisma.simulatedWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: wallet.availableBalance - sizeUsd,
        reservedTrading: wallet.reservedTrading + sizeUsd,
      },
    });

    const trade = await prisma.trade.create({
      data: {
        userId,
        assetSymbol: symbol,
        direction,
        orderType,
        status: isMarket ? 'open' : 'pending',
        sizeUsd,
        units,
        entryPrice: isMarket ? entryPrice : null,
        limitPrice: !isMarket ? limitPrice : null,
        stopLoss: stopLoss || null,
        takeProfit: takeProfit || null,
        openedAt: isMarket ? new Date() : null,
      },
      include: { asset: true },
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'ORDER_PLACED',
        actorId: userId,
        actorRole: req.user!.role,
        targetEntityType: 'trade',
        targetEntityId: trade.id,
        metadata: JSON.stringify({ symbol, direction, orderType, sizeUsd, entryPrice }),
      },
    });

    res.status(201).json({
      success: true,
      data: trade,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ORDER_ERROR', message: err.message } });
  }
});

export default router;
