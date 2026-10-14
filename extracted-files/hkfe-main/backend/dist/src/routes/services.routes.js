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
const router = (0, express_1.Router)();
// GET /services
router.get('/', async (_req, res) => {
    try {
        const services = await prisma_1.default.strategy.findMany({
            where: { isActive: true },
            include: { asset: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ success: true, data: services });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVICES_ERROR', message: err.message } });
    }
});
// GET /services/:id
router.get('/:id', async (req, res) => {
    try {
        const service = await prisma_1.default.strategy.findUnique({
            where: { id: req.params.id },
            include: { asset: true },
        });
        if (!service)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
        res.json({ success: true, data: service });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVICE_ERROR', message: err.message } });
    }
});
// POST /services/:id/subscribe
router.post('/:id/subscribe', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.subscribeStrategySchema), async (req, res) => {
    try {
        const strategyId = req.params.id;
        const { allocatedUsd, config } = req.body;
        const userId = req.user.id;
        const [strategy, wallet] = await Promise.all([
            prisma_1.default.strategy.findUnique({ where: { id: strategyId } }),
            prisma_1.default.simulatedWallet.findUnique({ where: { userId } }),
        ]);
        if (!strategy)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Strategy not found' } });
        if (!wallet)
            return res.status(404).json({ success: false, error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' } });
        if (wallet.availableBalance < allocatedUsd) {
            return res.status(400).json({
                success: false,
                error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient available funds to allocate to this service.' },
            });
        }
        const isEarn = strategy.strategyType === 'earn';
        const reservedField = isEarn ? 'reservedEarn' : 'reservedBots';
        const [sub, updatedWallet] = await prisma_1.default.$transaction([
            prisma_1.default.strategySubscription.create({
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
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    availableBalance: wallet.availableBalance - allocatedUsd,
                    [reservedField]: wallet[reservedField] + allocatedUsd,
                },
            }),
        ]);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'STRATEGY_SUBSCRIBED',
                actorId: userId,
                actorRole: req.user.role,
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUBSCRIBE_ERROR', message: err.message } });
    }
});
// GET /subscriptions
router.get('/user/active', auth_1.authenticateJwt, async (req, res) => {
    try {
        const subscriptions = await prisma_1.default.strategySubscription.findMany({
            where: { userId: req.user.id },
            include: { strategy: true },
            orderBy: { startedAt: 'desc' },
        });
        res.json({ success: true, data: subscriptions });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUBS_ERROR', message: err.message } });
    }
});
// DELETE /subscriptions/:id (Stop subscription)
router.delete('/user/:id', auth_1.authenticateJwt, async (req, res) => {
    try {
        const subId = req.params.id;
        const userId = req.user.id;
        const sub = await prisma_1.default.strategySubscription.findFirst({
            where: { id: subId, userId },
            include: { strategy: true },
        });
        if (!sub)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
        const wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet)
            return res.status(404).json({ success: false, error: { code: 'NO_WALLET', message: 'Wallet not found' } });
        const isEarn = sub.strategy.strategyType === 'earn';
        const reservedField = isEarn ? 'reservedEarn' : 'reservedBots';
        const [updatedSub, updatedWallet] = await prisma_1.default.$transaction([
            prisma_1.default.strategySubscription.update({
                where: { id: sub.id },
                data: {
                    status: 'stopped',
                    stoppedAt: new Date(),
                },
            }),
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    availableBalance: wallet.availableBalance + sub.allocatedUsd + sub.accruedYield + sub.totalPnl,
                    [reservedField]: Math.max(0, wallet[reservedField] - sub.allocatedUsd),
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'STOP_ERROR', message: err.message } });
    }
});
exports.default = router;
