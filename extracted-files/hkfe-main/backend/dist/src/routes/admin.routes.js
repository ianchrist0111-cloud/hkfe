"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const schemas_1 = require("../schemas");
const priceEngineService_1 = __importDefault(require("../services/priceEngineService"));
const notifications_routes_1 = require("./notifications.routes");
const emailService_1 = require("../services/emailService");
const router = (0, express_1.Router)();
// Protect all admin endpoints with admin/super_admin role
router.use(auth_1.authenticateJwt);
router.use((0, auth_1.requireRole)(['admin', 'super_admin']));
// ─── Role hierarchy: super_admin (2) > admin (1) > user (0) ───
const ROLE_RANK = { user: 0, admin: 1, super_admin: 2 };
const rankOf = (role) => ROLE_RANK[role || 'user'] ?? 0;
/**
 * An actor may only manage accounts strictly below their own rank
 * (super admins may manage everyone except they cannot demote themselves).
 */
const canManage = (actor, target) => {
    if (actor.role === 'super_admin')
        return true;
    return rankOf(actor.role) > rankOf(target.role);
};
const stripKycImages = (u) => {
    if (!u.kycRecord)
        return u;
    const { documentRef, documentBackRef, selfieRef, ...rest } = u.kycRecord;
    return {
        ...u,
        kycRecord: {
            ...rest,
            hasDocumentFront: !!documentRef,
            hasDocumentBack: !!documentBackRef,
            hasSelfie: !!selfieRef,
        },
    };
};
// GET /admin/stats
router.get('/stats', async (_req, res) => {
    try {
        const [userCount, activeTradesCount, totalVolumeResult, totalWallets] = await Promise.all([
            prisma_1.default.user.count(),
            prisma_1.default.trade.count({ where: { status: 'open' } }),
            prisma_1.default.trade.aggregate({ _sum: { sizeUsd: true } }),
            prisma_1.default.simulatedWallet.aggregate({ _sum: { totalBalance: true } }),
        ]);
        res.json({
            success: true,
            data: {
                totalUsers: userCount,
                activeOpenTrades: activeTradesCount,
                totalSimulatedVolumeUsd: totalVolumeResult._sum.sizeUsd || 0,
                totalPlatformAssetsUsd: totalWallets._sum.totalBalance || 0,
                priceFeedStatus: priceEngineService_1.default.getInstance().isFeedPaused() ? 'paused' : 'running',
                systemHealth: 'optimal',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'ADMIN_STATS_ERROR', message: err.message } });
    }
});
// GET /admin/users
router.get('/users', async (req, res) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const where = {};
        if (search) {
            where.OR = [
                { email: { contains: search } },
                { firstName: { contains: search } },
                { lastName: { contains: search } },
            ];
        }
        const [total, users] = await Promise.all([
            prisma_1.default.user.count({ where }),
            prisma_1.default.user.findMany({
                where,
                include: { wallet: true, kycRecord: true },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);
        res.json({
            success: true,
            data: {
                users: users.map(({ passwordHash, mfaSecret, mfaBackupCodes, ...u }) => stripKycImages(u)),
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'ADMIN_USERS_ERROR', message: err.message } });
    }
});
// GET /admin/users/:id
router.get('/users/:id', async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.params.id },
            include: {
                wallet: true,
                kycRecord: true,
                trades: { take: 10, orderBy: { createdAt: 'desc' } },
                strategySubscriptions: { include: { strategy: true } },
            },
        });
        if (!user)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        const { passwordHash, mfaSecret, mfaBackupCodes, ...safeUser } = user;
        res.json({ success: true, data: safeUser });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'ADMIN_USER_ERROR', message: err.message } });
    }
});
// PATCH /admin/users/:id
router.patch('/users/:id', (0, validate_1.validateBody)(schemas_1.adminUpdateUserSchema), async (req, res) => {
    try {
        const { role, status, kycStatus, tradingBlocked, withdrawalsBlocked, depositsBlocked } = req.body;
        const actor = req.user;
        const target = await prisma_1.default.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
        if (!target)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        if (target.id === actor.id && (role || status)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot change your own role or account status.' } });
        }
        if (!canManage(actor, target)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to modify an account with equal or higher privileges.' } });
        }
        if (role && actor.role !== 'super_admin') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only a Super Admin can change user roles.' } });
        }
        const updated = await prisma_1.default.user.update({
            where: { id: req.params.id },
            data: {
                ...(role && { role }),
                ...(status && { status }),
                ...(kycStatus && { kycStatus }),
                ...(typeof tradingBlocked === 'boolean' && { tradingBlocked }),
                ...(typeof withdrawalsBlocked === 'boolean' && { withdrawalsBlocked }),
                ...(typeof depositsBlocked === 'boolean' && { depositsBlocked }),
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
                kycStatus: true,
                tradingBlocked: true,
                withdrawalsBlocked: true,
                depositsBlocked: true,
            },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ADMIN_USER_UPDATED',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'user',
                targetEntityId: updated.id,
                metadata: JSON.stringify(req.body),
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'UPDATE_FAILED', message: err.message } });
    }
});
// POST /admin/users/:id/set-password — Staff sets a password after a reset request
router.post('/users/:id/set-password', (0, validate_1.validateBody)(schemas_1.adminSetPasswordSchema), async (req, res) => {
    try {
        const target = await prisma_1.default.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, role: true, email: true },
        });
        if (!target)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        if (target.id === req.user.id) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Use your own account settings to change your password.' } });
        }
        if (!canManage(req.user, target)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to set this account password.' } });
        }
        const passwordHash = await bcryptjs_1.default.hash(req.body.newPassword, 12);
        await prisma_1.default.user.update({
            where: { id: target.id },
            data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ADMIN_PASSWORD_SET',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'user',
                targetEntityId: target.id,
                metadata: JSON.stringify({ email: target.email }),
            },
        });
        res.json({ success: true, data: { message: 'Password updated. Tell the account holder the new password directly. It is not emailed.' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SET_PASSWORD_FAILED', message: err.message } });
    }
});
function generateClientPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const all = upper + lower + digits;
    const pick = (set) => set[crypto_1.default.randomInt(set.length)];
    const chars = [pick(upper), pick(lower), pick(digits), ...Array.from({ length: 9 }, () => pick(all))];
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto_1.default.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return `Hk${chars.join('')}!`;
}
// POST /admin/users/:id/generate-password — Create a password and email it to the client
router.post('/users/:id/generate-password', async (req, res) => {
    try {
        const target = await prisma_1.default.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, role: true, email: true, firstName: true },
        });
        if (!target)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        if (target.id === req.user.id) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Use your own account settings to change your password.' } });
        }
        if (!canManage(req.user, target)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to reset this account password.' } });
        }
        const password = generateClientPassword();
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await prisma_1.default.user.update({
            where: { id: target.id },
            data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
        });
        const emailed = await (0, emailService_1.sendEmail)({
            to: target.email,
            subject: 'HKFES Trading — your new password',
            html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
          <h2 style="margin:0 0 8px;">Your password was reset</h2>
          <p>An administrator generated a new password for your HKFES account.</p>
          <p style="font-size:20px;font-weight:700;letter-spacing:0.04em;">${password}</p>
          <p>Sign in with this password, then change it from your account settings.</p>
        </div>
      `,
        });
        const note = emailed
            ? 'A new password was generated and emailed to the client.'
            : 'A new password was generated. Email delivery failed, so the admin must send the password to the client directly.';
        const openRequests = await prisma_1.default.supportTicket.findMany({
            where: {
                userId: target.id,
                subject: 'Password reset requested',
                status: { in: ['open', 'in_progress', 'awaiting_user'] },
            },
            select: { id: true },
        });
        if (openRequests.length > 0) {
            await prisma_1.default.supportMessage.createMany({
                data: openRequests.map((ticket) => ({
                    ticketId: ticket.id,
                    authorId: req.user.id,
                    authorRole: req.user.role,
                    authorName: 'HKFES Support',
                    body: note,
                })),
            });
            await prisma_1.default.supportTicket.updateMany({
                where: { id: { in: openRequests.map((ticket) => ticket.id) } },
                data: { status: 'resolved', resolvedAt: new Date(), lastActivityAt: new Date() },
            });
        }
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ADMIN_PASSWORD_GENERATED',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'user',
                targetEntityId: target.id,
                metadata: JSON.stringify({ email: target.email, emailed }),
            },
        });
        res.json({
            success: true,
            data: {
                password,
                emailed,
                email: target.email,
                message: emailed
                    ? `New password emailed to ${target.email}.`
                    : `Password saved, but the email to ${target.email} was not delivered. Copy it and send it to the client.`,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'GENERATE_PASSWORD_FAILED', message: err.message } });
    }
});
// POST /admin/users/:id/reset-balance
router.post('/users/:id/reset-balance', (0, validate_1.validateBody)(schemas_1.adminResetBalanceSchema), async (req, res) => {
    try {
        const { newBalance, reason } = req.body;
        const targetUserId = req.params.id;
        const targetUser = await prisma_1.default.user.findUnique({ where: { id: targetUserId }, select: { id: true, role: true } });
        if (!targetUser)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        if (targetUser.id !== req.user.id && !canManage(req.user, targetUser)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot modify the wallet of an account with equal or higher privileges.' } });
        }
        const wallet = await prisma_1.default.simulatedWallet.findUnique({ where: { userId: targetUserId } });
        if (!wallet)
            return res.status(404).json({ success: false, error: { code: 'NO_WALLET', message: 'Wallet not found' } });
        const [updatedWallet, tx] = await prisma_1.default.$transaction([
            prisma_1.default.simulatedWallet.update({
                where: { id: wallet.id },
                data: {
                    totalBalance: newBalance,
                    availableBalance: newBalance,
                    reservedTrading: 0.0,
                    reservedEarn: 0.0,
                    reservedBots: 0.0,
                },
            }),
            prisma_1.default.transaction.create({
                data: {
                    walletId: wallet.id,
                    userId: targetUserId,
                    type: 'balance_reset',
                    amount: newBalance - wallet.totalBalance,
                    balanceBefore: wallet.totalBalance,
                    balanceAfter: newBalance,
                    description: `Admin balance reset (${reason || 'Standard test reset'})`,
                    status: 'completed',
                },
            }),
        ]);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ADMIN_BALANCE_RESET',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'wallet',
                targetEntityId: wallet.id,
                metadata: JSON.stringify({ targetUserId, newBalance, reason }),
            },
        });
        res.json({ success: true, data: { wallet: updatedWallet, transaction: tx } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'RESET_FAILED', message: err.message } });
    }
});
// GET /admin/kyc/queue?status=pending|approved|rejected|not_submitted|all
router.get('/kyc/queue', async (req, res) => {
    try {
        const status = req.query.status || 'all';
        const users = await prisma_1.default.user.findMany({
            where: { role: 'user' },
            include: { kycRecord: true },
            orderBy: { createdAt: 'desc' },
            take: 300,
        });
        const rows = users.map(u => {
            const submitted = !!u.kycRecord?.submittedAt;
            const queueStatus = u.kycStatus === 'pending' && !submitted ? 'not_submitted' : u.kycStatus;
            return {
                id: u.id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                dateOfBirth: u.dateOfBirth,
                phoneNumber: u.phoneNumber,
                kycStatus: u.kycStatus,
                queueStatus,
                createdAt: u.createdAt,
                kycRecord: u.kycRecord,
            };
        });
        const filtered = status === 'all' ? rows : rows.filter(r => r.queueStatus === status);
        // Oldest submissions first for pending queue (FIFO review)
        if (status === 'pending') {
            filtered.sort((a, b) => new Date(a.kycRecord?.submittedAt || 0).getTime() - new Date(b.kycRecord?.submittedAt || 0).getTime());
        }
        const counts = rows.reduce((acc, r) => {
            acc[r.queueStatus] = (acc[r.queueStatus] || 0) + 1;
            return acc;
        }, {});
        res.json({ success: true, data: { applicants: filtered, counts } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'KYC_QUEUE_ERROR', message: err.message } });
    }
});
// POST /admin/kyc/:userId/review  { decision: 'approved' | 'rejected', notes? }
router.post('/kyc/:userId/review', (0, validate_1.validateBody)(schemas_1.adminKycReviewSchema), async (req, res) => {
    try {
        const { decision, notes } = req.body;
        const target = await prisma_1.default.user.findUnique({ where: { id: req.params.userId }, include: { kycRecord: true } });
        if (!target)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        if (!canManage(req.user, target)) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient privileges for this account.' } });
        }
        if (!target.kycRecord?.submittedAt) {
            return res.status(409).json({ success: false, error: { code: 'KYC_NOT_SUBMITTED', message: 'This applicant has not submitted a verification application yet.' } });
        }
        if (decision === 'rejected' && !notes) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A rejection reason is required so the applicant knows what to fix.' } });
        }
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({ where: { id: target.id }, data: { kycStatus: decision } }),
            prisma_1.default.kYCRecord.update({
                where: { userId: target.id },
                data: { reviewedAt: new Date(), reviewedByAdminId: req.user.id, notes: notes || null },
            }),
        ]);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: decision === 'approved' ? 'KYC_APPROVED' : 'KYC_REJECTED',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'user',
                targetEntityId: target.id,
                metadata: JSON.stringify({ caseReference: target.kycRecord.caseReference, notes }),
            },
        });
        (0, notifications_routes_1.pushUserNotification)(target.id, decision === 'approved'
            ? { title: 'Identity verified ✅', message: 'Your KYC application has been approved. Full trading, deposits and withdrawals are now unlocked.', type: 'kyc' }
            : { title: 'Verification needs attention', message: `Your KYC application was not approved: ${notes}. Please resubmit from the Identity Verification page.`, type: 'kyc' });
        res.json({ success: true, data: { userId: target.id, kycStatus: decision } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'KYC_REVIEW_ERROR', message: err.message } });
    }
});
// POST /admin/users/bulk-reset-balance
router.post('/users/bulk-reset-balance', async (req, res) => {
    try {
        const defaultBalance = 10000.0;
        await prisma_1.default.simulatedWallet.updateMany({
            data: {
                totalBalance: defaultBalance,
                availableBalance: defaultBalance,
                reservedTrading: 0.0,
                reservedEarn: 0.0,
                reservedBots: 0.0,
            },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ADMIN_BULK_BALANCE_RESET',
                actorId: req.user.id,
                actorRole: req.user.role,
                metadata: JSON.stringify({ resetValue: defaultBalance }),
            },
        });
        res.json({ success: true, data: { message: 'All user wallets reset to $10,000 USD successfully.' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'BULK_RESET_FAILED', message: err.message } });
    }
});
// POST /admin/engine/spike (Inject volatility)
router.post('/engine/spike', (0, validate_1.validateBody)(schemas_1.adminSpikeSchema), async (req, res) => {
    try {
        const { symbol, magnitudePercent, direction } = req.body;
        priceEngineService_1.default.getInstance().injectSpike(symbol, magnitudePercent, direction);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ADMIN_ENGINE_SPIKE',
                actorId: req.user.id,
                actorRole: req.user.role,
                metadata: JSON.stringify(req.body),
            },
        });
        res.json({ success: true, data: { message: `Spike of ${magnitudePercent}% (${direction}) injected.` } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SPIKE_ERROR', message: err.message } });
    }
});
// POST /admin/engine/pause
router.post('/engine/pause', (req, res) => {
    priceEngineService_1.default.getInstance().pause();
    res.json({ success: true, data: { message: 'Price simulation paused.' } });
});
// POST /admin/engine/resume
router.post('/engine/resume', (req, res) => {
    priceEngineService_1.default.getInstance().resume();
    res.json({ success: true, data: { message: 'Price simulation resumed.' } });
});
// POST /admin/engine/reset-prices
router.post('/engine/reset-prices', async (_req, res) => {
    await priceEngineService_1.default.getInstance().resetPrices();
    res.json({ success: true, data: { message: 'All asset prices reset to initial seeds.' } });
});
// POST /admin/engine/live-sync — Calibrate asset prices with real-world crypto exchange tickers
router.post('/engine/live-sync', async (req, res) => {
    try {
        const result = await priceEngineService_1.default.getInstance().syncLiveMarketData();
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'ENGINE_LIVE_MARKET_SYNC',
                actorId: req.user.id,
                actorRole: req.user.role,
                metadata: JSON.stringify(result),
            },
        });
        res.json({
            success: true,
            data: {
                message: `Synchronized ${result.synced} assets with real-world exchange market quotes.`,
                details: result.details,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'LIVE_SYNC_ERROR', message: err.message } });
    }
});
// GET /admin/audit-logs
router.get('/audit-logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '50', 10);
        const [total, logs] = await Promise.all([
            prisma_1.default.auditLog.count(),
            prisma_1.default.auditLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);
        res.json({
            success: true,
            data: {
                logs,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'AUDIT_LOG_ERROR', message: err.message } });
    }
});
// GET /admin/reports/generate
router.get('/reports/generate', async (req, res) => {
    try {
        const format = req.query.format === 'pdf' ? 'pdf' : 'csv';
        const usersCount = await prisma_1.default.user.count();
        const tradesCount = await prisma_1.default.trade.count();
        const txCount = await prisma_1.default.transaction.count();
        if (format === 'csv') {
            const csv = `Metric,Value\nTotal Users,${usersCount}\nTotal Trades,${tradesCount}\nTotal Transactions,${txCount}\nGenerated At,${new Date().toISOString()}\n`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="hkfes-platform-report.csv"');
            return res.send(csv);
        }
        res.json({
            success: true,
            data: {
                format,
                generatedAt: new Date().toISOString(),
                summary: { usersCount, tradesCount, txCount },
                downloadUrl: '/api/v1/admin/reports/generate?format=csv',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: err.message } });
    }
});
exports.default = router;
