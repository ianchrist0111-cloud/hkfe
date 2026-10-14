"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// GET /users/me
router.get('/me', auth_1.authenticateJwt, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
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
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
});
// PATCH /users/me
router.patch('/me', auth_1.authenticateJwt, async (req, res) => {
    try {
        const { firstName, lastName, phoneNumber } = req.body;
        const updated = await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: {
                ...(firstName !== undefined && { firstName }),
                ...(lastName !== undefined && { lastName }),
                ...(phoneNumber !== undefined && { phoneNumber }),
            },
            select: { id: true, email: true, firstName: true, lastName: true, phoneNumber: true },
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: err.message } });
    }
});
// PATCH /users/me/password
router.patch('/me/password', auth_1.authenticateJwt, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 8 characters long.' },
            });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        const isValid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Current password does not match.' } });
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });
        res.json({ success: true, data: { message: 'Password updated successfully.' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'PASSWORD_ERROR', message: err.message } });
    }
});
// POST /users/me/push-subscription
router.post('/me/push-subscription', auth_1.authenticateJwt, async (req, res) => {
    try {
        const { endpoint, p256dh, auth, platform } = req.body;
        if (!endpoint || !p256dh || !auth) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing push subscription fields.' } });
        }
        const sub = await prisma_1.default.pushSubscription.create({
            data: {
                userId: req.user.id,
                endpoint,
                p256dh,
                auth,
                platform: platform || 'desktop',
            },
        });
        res.json({ success: true, data: sub });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'PUSH_ERROR', message: err.message } });
    }
});
exports.default = router;
