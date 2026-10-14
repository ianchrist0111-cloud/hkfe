"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const schemas_1 = require("../schemas");
const priceEngineService_1 = __importDefault(require("../services/priceEngineService"));
const router = (0, express_1.Router)();
// POST /trading/orders (Place simulated order)
router.post('/orders', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.placeOrderSchema), async (req, res) => {
    try {
        const { symbol, direction, orderType, sizeUsd, limitPrice, stopLoss, takeProfit } = req.body;
        const userId = req.user.id;
        const user = await prisma_1.default.user.findUnique({
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
        let wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet) {
            wallet = await prisma_1.default.simulatedWallet.create({
                data: {
                    userId,
                    totalBalance: 10000.0,
                    availableBalance: 10000.0,
                    currency: 'USD',
                },
            });
        }
        let asset = await prisma_1.default.asset.findUnique({ where: { symbol } });
        if (!asset) {
            const liveP = priceEngineService_1.default.getInstance().getCurrentPrice(symbol) || 100.0;
            asset = await prisma_1.default.asset.create({
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
        const currentPrice = priceEngineService_1.default.getInstance().getCurrentPrice(symbol) || asset.currentPrice;
        const isMarket = orderType === 'market';
        const entryPrice = isMarket ? currentPrice : limitPrice || currentPrice;
        const units = Number((sizeUsd / entryPrice).toFixed(6));
        // Deduct available balance, add to reserved
        await prisma_1.default.simulatedWallet.update({
            where: { id: wallet.id },
            data: {
                availableBalance: wallet.availableBalance - sizeUsd,
                reservedTrading: wallet.reservedTrading + sizeUsd,
            },
        });
        const trade = await prisma_1.default.trade.create({
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
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ORDER_PLACED',
                actorId: userId,
                actorRole: req.user.role,
                targetEntityType: 'trade',
                targetEntityId: trade.id,
                metadata: JSON.stringify({ symbol, direction, orderType, sizeUsd, entryPrice }),
            },
        });
        res.status(201).json({
            success: true,
            data: trade,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'ORDER_ERROR', message: err.message } });
    }
});
// GET /trading/orders (Pending/Limit orders)
router.get('/orders', auth_1.authenticateJwt, async (req, res) => {
    try {
        const orders = await prisma_1.default.trade.findMany({
            where: {
                userId: req.user.id,
                status: 'pending',
            },
            include: { asset: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: orders });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'ORDERS_ERROR', message: err.message } });
    }
});
// GET /trading/positions (Open positions with live unrealized P&L)
router.get('/positions', auth_1.authenticateJwt, async (req, res) => {
    try {
        const positions = await prisma_1.default.trade.findMany({
            where: {
                userId: req.user.id,
                status: 'open',
            },
            include: { asset: true },
            orderBy: { openedAt: 'desc' },
        });
        const engine = priceEngineService_1.default.getInstance();
        const formatted = positions.map((pos) => {
            const livePrice = engine.getCurrentPrice(pos.assetSymbol) || pos.asset.currentPrice;
            const entryPrice = pos.entryPrice || livePrice;
            const priceDiff = pos.direction === 'buy' ? livePrice - entryPrice : entryPrice - livePrice;
            const unrealizedPnl = Number(((priceDiff / entryPrice) * pos.sizeUsd).toFixed(2));
            const pnlPercent = Number(((priceDiff / entryPrice) * 100).toFixed(2));
            return {
                ...pos,
                currentPrice: livePrice,
                unrealizedPnl,
                pnlPercent,
            };
        });
        res.json({ success: true, data: formatted });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'POSITIONS_ERROR', message: err.message } });
    }
});
// POST /trading/positions/:id/close
router.post('/positions/:id/close', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.closePositionSchema), async (req, res) => {
    try {
        const tradeId = req.params.id;
        const userId = req.user.id;
        const trade = await prisma_1.default.trade.findFirst({
            where: { id: tradeId, userId, status: 'open' },
            include: { asset: true },
        });
        if (!trade) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Open position not found.' } });
        }
        const livePrice = priceEngineService_1.default.getInstance().getCurrentPrice(trade.assetSymbol) || trade.asset.currentPrice;
        const entryPrice = trade.entryPrice || livePrice;
        const priceDiff = trade.direction === 'buy' ? livePrice - entryPrice : entryPrice - livePrice;
        const realizedPnl = Number(((priceDiff / entryPrice) * trade.sizeUsd).toFixed(2));
        const wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet)
            return res.status(404).json({ success: false, error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' } });
        const newTotal = wallet.totalBalance + realizedPnl;
        const newAvailable = wallet.availableBalance + trade.sizeUsd + realizedPnl;
        const newReserved = Math.max(0, wallet.reservedTrading - trade.sizeUsd);
        const [updatedTrade, updatedWallet] = await prisma_1.default.$transaction([
            prisma_1.default.trade.update({
                where: { id: trade.id },
                data: {
                    status: 'closed',
                    exitPrice: livePrice,
                    realizedPnl,
                    closedAt: new Date(),
                },
            }),
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    totalBalance: newTotal,
                    availableBalance: newAvailable,
                    reservedTrading: newReserved,
                },
            }),
            prisma_1.default.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    type: 'trade_pnl',
                    amount: realizedPnl,
                    balanceBefore: wallet.totalBalance,
                    balanceAfter: newTotal,
                    referenceId: trade.id,
                    referenceType: 'trade',
                    description: `Closed ${trade.direction.toUpperCase()} ${trade.assetSymbol} (P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl})`,
                },
            }),
        ]);
        res.json({
            success: true,
            data: {
                trade: updatedTrade,
                wallet: updatedWallet,
                realizedPnl,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'CLOSE_ERROR', message: err.message } });
    }
});
// GET /trading/history
router.get('/history', auth_1.authenticateJwt, async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const where = { userId: req.user.id, status: 'closed' };
        const [total, history] = await Promise.all([
            prisma_1.default.trade.count({ where }),
            prisma_1.default.trade.findMany({
                where,
                include: { asset: true },
                orderBy: { closedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);
        res.json({
            success: true,
            data: {
                history,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'HISTORY_ERROR', message: err.message } });
    }
});
// ─── Short-Term Options (30s, 60s, 90s, 120s) ──────────────────
// POST /trading/options/order — Place short-term option contract
router.post('/options/order', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.placeShortTermOptionSchema), async (req, res) => {
    try {
        const { symbol, direction, durationSeconds, amount, payoutRate = 0.90 } = req.body;
        const userId = req.user.id;
        // Check compliance restriction
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { status: true, tradingBlocked: true },
        });
        if (!user || user.status === 'suspended' || user.tradingBlocked) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'TRADING_DISALLOWED',
                    message: user?.status === 'suspended'
                        ? 'Account is suspended. Short-term option trading is disabled.'
                        : 'Trading privileges are temporarily disabled for your account by Compliance.',
                },
            });
        }
        let wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet) {
            wallet = await prisma_1.default.simulatedWallet.create({
                data: { userId, totalBalance: 10000.0, availableBalance: 10000.0, currency: 'USD' },
            });
        }
        if (wallet.availableBalance < amount) {
            return res.status(400).json({
                success: false,
                error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient available margin for this contract.' },
            });
        }
        let asset = await prisma_1.default.asset.findUnique({ where: { symbol } });
        const liveP = priceEngineService_1.default.getInstance().getCurrentPrice(symbol) || asset?.currentPrice || 100.0;
        if (!asset) {
            asset = await prisma_1.default.asset.create({
                data: {
                    symbol,
                    displayName: symbol,
                    assetClass: symbol.includes('/') ? 'crypto' : 'fx',
                    seedPrice: liveP,
                    currentPrice: liveP,
                },
            });
        }
        const currentPrice = liveP;
        const normDirection = direction === 'buy' || direction === 'call' ? 'call' : 'put';
        const now = new Date();
        const targetExpiry = new Date(now.getTime() + durationSeconds * 1000);
        // Atomically lock margin and create short-term option contract
        const [updatedWallet, contract] = await prisma_1.default.$transaction([
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    availableBalance: { decrement: amount },
                    reservedTrading: { increment: amount },
                },
            }),
            prisma_1.default.trade.create({
                data: {
                    userId,
                    assetSymbol: symbol,
                    direction: normDirection,
                    orderType: 'short_term_option',
                    status: 'open',
                    sizeUsd: amount,
                    units: Number((amount / currentPrice).toFixed(6)),
                    entryPrice: currentPrice,
                    strikePrice: currentPrice,
                    durationSeconds,
                    payoutRate,
                    openedAt: now,
                    targetExpiry,
                    notes: JSON.stringify({ durationSeconds, payoutRate, strikePrice: currentPrice }),
                },
                include: { asset: true },
            }),
        ]);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'SHORT_TERM_OPTION_PLACED',
                actorId: userId,
                actorRole: req.user.role,
                targetEntityType: 'trade',
                targetEntityId: contract.id,
                metadata: JSON.stringify({ symbol, direction: normDirection, durationSeconds, amount, strikePrice: currentPrice, payoutRate }),
            },
        });
        res.status(201).json({
            success: true,
            data: {
                contract,
                wallet: updatedWallet,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'OPTION_ORDER_ERROR', message: err.message } });
    }
});
// POST /trading/options/:id/settle — Settle short-term option upon expiry
router.post('/options/:id/settle', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.settleShortTermOptionSchema), async (req, res) => {
    try {
        const contractId = req.params.id;
        const userId = req.user.id;
        const contract = await prisma_1.default.trade.findFirst({
            where: {
                id: contractId,
                userId,
                orderType: 'short_term_option',
            },
            include: { asset: true },
        });
        if (!contract) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Option contract not found.' } });
        }
        if (contract.status !== 'open') {
            return res.json({ success: true, data: { contract, alreadySettled: true } });
        }
        const livePrice = req.body.exitPrice || priceEngineService_1.default.getInstance().getCurrentPrice(contract.assetSymbol) || contract.asset.currentPrice;
        const strikePrice = contract.strikePrice ?? contract.entryPrice ?? livePrice;
        const payoutRate = contract.payoutRate ?? 0.90;
        const isCall = contract.direction === 'call' || contract.direction === 'buy';
        let outcome;
        if (livePrice === strikePrice) {
            outcome = 'tied';
        }
        else if (isCall) {
            outcome = livePrice > strikePrice ? 'won' : 'lost';
        }
        else {
            outcome = livePrice < strikePrice ? 'won' : 'lost';
        }
        const wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new Error('Wallet not found');
        const stake = contract.sizeUsd;
        let realizedPnl;
        let totalReturn;
        let status;
        if (outcome === 'won') {
            realizedPnl = Number((stake * payoutRate).toFixed(2));
            totalReturn = stake + realizedPnl; // original stake + net profit
            status = 'won';
        }
        else if (outcome === 'tied') {
            realizedPnl = 0;
            totalReturn = stake; // full refund
            status = 'tied';
        }
        else {
            realizedPnl = -stake;
            totalReturn = 0;
            status = 'lost';
        }
        const newTotal = Number((wallet.totalBalance + (outcome === 'won' ? realizedPnl : outcome === 'lost' ? -stake : 0)).toFixed(2));
        const newAvailable = Number((wallet.availableBalance + totalReturn).toFixed(2));
        const newReserved = Math.max(0, Number((wallet.reservedTrading - stake).toFixed(2)));
        const [updatedContract, updatedWallet] = await prisma_1.default.$transaction([
            prisma_1.default.trade.update({
                where: { id: contract.id },
                data: {
                    status,
                    exitPrice: livePrice,
                    realizedPnl,
                    closedAt: new Date(),
                },
            }),
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    totalBalance: newTotal,
                    availableBalance: newAvailable,
                    reservedTrading: newReserved,
                },
            }),
            prisma_1.default.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    type: 'trade_pnl',
                    amount: realizedPnl,
                    balanceBefore: wallet.totalBalance,
                    balanceAfter: newTotal,
                    referenceId: contract.id,
                    referenceType: 'short_term_option',
                    description: `Settled ${contract.durationSeconds}s Option: ${contract.direction.toUpperCase()} ${contract.assetSymbol} (${outcome.toUpperCase()}) — Strike: $${strikePrice.toFixed(4)}, Exit: $${livePrice.toFixed(4)}`,
                },
            }),
        ]);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'SHORT_TERM_OPTION_SETTLED',
                actorId: userId,
                actorRole: req.user.role,
                targetEntityType: 'trade',
                targetEntityId: contract.id,
                metadata: JSON.stringify({ outcome, strikePrice, exitPrice: livePrice, realizedPnl, totalReturn }),
            },
        });
        res.json({
            success: true,
            data: {
                contract: updatedContract,
                wallet: updatedWallet,
                outcome,
                strikePrice,
                exitPrice: livePrice,
                realizedPnl,
                totalReturn,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SETTLE_ERROR', message: err.message } });
    }
});
// GET /trading/options/active — Get active contracts
router.get('/options/active', auth_1.authenticateJwt, async (req, res) => {
    try {
        const contracts = await prisma_1.default.trade.findMany({
            where: {
                userId: req.user.id,
                orderType: 'short_term_option',
                status: 'open',
            },
            include: { asset: true },
            orderBy: { openedAt: 'desc' },
        });
        const engine = priceEngineService_1.default.getInstance();
        const formatted = contracts.map((c) => {
            const livePrice = engine.getCurrentPrice(c.assetSymbol) || c.asset.currentPrice;
            const strike = c.strikePrice || c.entryPrice || livePrice;
            const isCall = c.direction === 'call' || c.direction === 'buy';
            const isItm = isCall ? livePrice > strike : livePrice < strike;
            const now = Date.now();
            const expiryMs = c.targetExpiry ? new Date(c.targetExpiry).getTime() : now;
            const remainingSeconds = Math.max(0, Math.ceil((expiryMs - now) / 1000));
            return {
                ...c,
                currentPrice: livePrice,
                isItm,
                remainingSeconds,
            };
        });
        res.json({ success: true, data: { contracts: formatted, total: formatted.length } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'ACTIVE_OPTIONS_ERROR', message: err.message } });
    }
});
exports.default = router;
