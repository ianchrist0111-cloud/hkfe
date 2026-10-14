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
// GET /wallet
router.get('/', auth_1.authenticateJwt, async (req, res) => {
    try {
        let wallet = await prisma_1.default.simulatedWallet.findUnique({
            where: { userId: req.user.id },
        });
        if (!wallet) {
            wallet = await prisma_1.default.simulatedWallet.create({
                data: {
                    userId: req.user.id,
                    totalBalance: 10000.0,
                    availableBalance: 10000.0,
                    currency: 'USD',
                },
            });
        }
        res.json({ success: true, data: wallet });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'WALLET_ERROR', message: err.message } });
    }
});
// POST /wallet/deposit
router.post('/deposit', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.depositSchema), async (req, res) => {
    try {
        const { amount, method } = req.body;
        const userId = req.user.id;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { status: true, depositsBlocked: true },
        });
        if (!user || user.status === 'deleted' || user.depositsBlocked) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'DEPOSITS_DISALLOWED',
                    message: 'Deposit crediting is currently restricted for your account by Compliance.',
                },
            });
        }
        const wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
        const balanceBefore = wallet.totalBalance;
        const balanceAfter = balanceBefore + amount;
        const [updatedWallet, tx] = await prisma_1.default.$transaction([
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    totalBalance: balanceAfter,
                    availableBalance: wallet.availableBalance + amount,
                },
            }),
            prisma_1.default.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    type: 'deposit',
                    amount,
                    balanceBefore,
                    balanceAfter,
                    description: `Simulated deposit via ${method}`,
                    status: 'completed',
                },
            }),
        ]);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'WALLET_DEPOSIT',
                actorId: userId,
                actorRole: req.user.role,
                targetEntityType: 'wallet',
                targetEntityId: wallet.id,
                metadata: JSON.stringify({ amount, method }),
            },
        });
        res.json({
            success: true,
            data: {
                wallet: updatedWallet,
                transaction: tx,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'DEPOSIT_ERROR', message: err.message } });
    }
});
// POST /wallet/withdraw
router.post('/withdraw', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.withdrawSchema), async (req, res) => {
    try {
        const { amount, destination, method } = req.body;
        const userId = req.user.id;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { status: true, withdrawalsBlocked: true },
        });
        if (!user || user.status === 'suspended' || user.withdrawalsBlocked) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'WITHDRAWALS_DISALLOWED',
                    message: user?.status === 'suspended'
                        ? 'Account is suspended. Withdrawals are disabled.'
                        : 'Withdrawals are currently restricted for your account by Compliance.',
                },
            });
        }
        const wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
        if (wallet.availableBalance < amount) {
            return res.status(400).json({
                success: false,
                error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient available balance for withdrawal.' },
            });
        }
        const balanceBefore = wallet.totalBalance;
        const balanceAfter = balanceBefore - amount;
        const [updatedWallet, tx] = await prisma_1.default.$transaction([
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    totalBalance: balanceAfter,
                    availableBalance: wallet.availableBalance - amount,
                },
            }),
            prisma_1.default.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    type: 'withdrawal',
                    amount: -amount,
                    balanceBefore,
                    balanceAfter,
                    description: `Simulated withdrawal to ${destination} (${method})`,
                    status: 'completed',
                },
            }),
        ]);
        res.json({
            success: true,
            data: {
                wallet: updatedWallet,
                transaction: tx,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'WITHDRAW_ERROR', message: err.message } });
    }
});
// POST /wallet/transfer (Internal sub-wallet transfer)
router.post('/transfer', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.walletTransferSchema), async (req, res) => {
    try {
        const { from, to, amount } = req.body;
        const userId = req.user.id;
        const wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId } });
        if (!wallet)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Wallet not found' } });
        const keyToField = {
            available: 'availableBalance',
            trading: 'reservedTrading',
            earn: 'reservedEarn',
            bots: 'reservedBots',
        };
        const fromField = keyToField[from];
        const toField = keyToField[to];
        if (wallet[fromField] < amount) {
            return res.status(400).json({
                success: false,
                error: { code: 'INSUFFICIENT_FUNDS', message: `Insufficient balance in ${from} sub-wallet.` },
            });
        }
        const [updatedWallet, tx] = await prisma_1.default.$transaction([
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    [fromField]: wallet[fromField] - amount,
                    [toField]: wallet[toField] + amount,
                },
            }),
            prisma_1.default.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    type: 'internal_transfer',
                    amount,
                    balanceBefore: wallet.totalBalance,
                    balanceAfter: wallet.totalBalance,
                    description: `Sub-wallet transfer: $${amount.toFixed(2)} from ${from} to ${to}`,
                    status: 'completed',
                },
            }),
        ]);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'WALLET_SUBWALLET_TRANSFER',
                actorId: userId,
                actorRole: req.user.role,
                targetEntityType: 'wallet',
                targetEntityId: wallet.id,
                metadata: JSON.stringify({ from, to, amount }),
            },
        });
        res.json({
            success: true,
            data: {
                wallet: updatedWallet,
                transaction: tx,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'TRANSFER_ERROR', message: err.message } });
    }
});
// GET /wallet/transactions
router.get('/transactions', auth_1.authenticateJwt, async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const type = req.query.type;
        const where = { userId: req.user.id };
        if (type)
            where.type = type;
        const [total, transactions] = await Promise.all([
            prisma_1.default.transaction.count({ where }),
            prisma_1.default.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);
        res.json({
            success: true,
            data: {
                transactions,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'TX_ERROR', message: err.message } });
    }
});
// GET /wallet/export
router.get('/export', auth_1.authenticateJwt, async (req, res) => {
    try {
        const txs = await prisma_1.default.transaction.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        let csv = 'ID,Type,Amount,Balance Before,Balance After,Description,Status,Date\n';
        txs.forEach((t) => {
            csv += `"${t.id}","${t.type}",${t.amount},${t.balanceBefore},${t.balanceAfter},"${t.description || ''}","${t.status}","${t.createdAt.toISOString()}"\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
        res.send(csv);
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'EXPORT_ERROR', message: err.message } });
    }
});
exports.default = router;
