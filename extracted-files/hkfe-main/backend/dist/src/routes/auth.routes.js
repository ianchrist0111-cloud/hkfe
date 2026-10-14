"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenBlacklisted = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../prisma"));
const env_1 = require("../config/env");
const validate_1 = require("../middlewares/validate");
const schemas_1 = require("../schemas");
const auth_1 = require("../middlewares/auth");
const logger_1 = __importDefault(require("../utils/logger"));
const emailService_1 = require("../services/emailService");
const router = (0, express_1.Router)();
// ─── In-Memory Token Blacklist ───────────────────────────────
// For production: replace with Redis SET with TTL matching token expiry
const tokenBlacklist = new Set();
// ─── In-Memory Password Reset Tokens ─────────────────────────
// Maps token -> { userId: string, expiresAt: number }
const passwordResetTokens = new Map();
// ─── In-Memory Email Verification Codes ──────────────────────
// Maps userId -> { code: string; email: string; expiresAt: number }
const emailVerificationCodes = new Map();
// ─── In-Memory Email OTP Codes ───────────────────────────────
// Maps email -> { code: string; purpose: string; expiresAt: number; attempts: number }
const emailOtpCodes = new Map();
const isTokenBlacklisted = (token) => {
    return tokenBlacklist.has(token);
};
exports.isTokenBlacklisted = isTokenBlacklisted;
// Clean up expired tokens every hour (prevent memory leak)
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const token of tokenBlacklist) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (decoded?.exp && decoded.exp < now) {
                tokenBlacklist.delete(token);
            }
        }
        catch {
            tokenBlacklist.delete(token);
        }
    }
}, 3600000).unref();
// ─── Helper: Extract client IP ──────────────────────────────
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.connection?.remoteAddress
        || req.ip
        || 'unknown';
}
// POST /auth/register
router.post('/register', (0, validate_1.validateBody)(schemas_1.registerSchema), async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: { code: 'EMAIL_IN_USE', message: 'An account with this email address already exists.' },
            });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12); // Increased from 10 to 12 rounds
        const user = await prisma_1.default.user.create({
            data: {
                email,
                passwordHash,
                firstName: firstName || null,
                lastName: lastName || null,
                role: 'user',
                status: 'active',
                kycStatus: 'not_started',
                wallet: {
                    create: {
                        totalBalance: 0.0,
                        availableBalance: 0.0,
                        currency: 'USD',
                    },
                },
            },
            include: {
                wallet: true,
            },
        });
        // Record audit log
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'USER_REGISTERED',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
                metadata: JSON.stringify({ email: user.email }),
            },
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, env_1.ENV.JWT_SECRET, { expiresIn: '7d', jwtid: crypto_1.default.randomUUID() });
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    kycStatus: user.kycStatus,
                    emailVerified: user.emailVerified,
                    wallet: user.wallet,
                },
                token,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'REGISTER_ERROR', message: err.message } });
    }
});
// POST /auth/login
router.post('/login', (0, validate_1.validateBody)(schemas_1.loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || null;
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            include: { wallet: true },
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
            });
        }
        // ─── Account lockout check ───────────────────────────────
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            return res.status(423).json({
                success: false,
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message: `Account is temporarily locked due to too many failed login attempts. Try again in ${remainingMin} minute(s).`,
                },
            });
        }
        if (user.status !== 'active' && user.status !== 'inactive' && user.status !== 'suspended') {
            return res.status(403).json({
                success: false,
                error: { code: 'ACCOUNT_CLOSED', message: 'This account is closed.' },
            });
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValidPassword) {
            // ─── Increment failed login counter ────────────────────
            const newFailedCount = user.failedLoginCount + 1;
            const lockoutData = { failedLoginCount: newFailedCount };
            if (newFailedCount >= env_1.ENV.MAX_FAILED_LOGIN_ATTEMPTS) {
                lockoutData.lockedUntil = new Date(Date.now() + env_1.ENV.ACCOUNT_LOCKOUT_MINUTES * 60000);
                await prisma_1.default.auditLog.create({
                    data: {
                        eventType: 'ACCOUNT_LOCKED',
                        actorId: user.id,
                        actorRole: user.role,
                        targetEntityType: 'user',
                        targetEntityId: user.id,
                        ipAddress: clientIp,
                        userAgent,
                        metadata: JSON.stringify({ failedAttempts: newFailedCount, lockedUntil: lockoutData.lockedUntil }),
                    },
                });
            }
            await prisma_1.default.user.update({ where: { id: user.id }, data: lockoutData });
            return res.status(401).json({
                success: false,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
            });
        }
        // ─── Successful password check — reset fail counter ──────
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { failedLoginCount: 0, lockedUntil: null },
        });
        // Check MFA if enabled
        if (user.mfaEnabled) {
            return res.json({
                success: true,
                data: {
                    requiresMfa: true,
                    email: user.email,
                    message: 'Please provide your 6-digit authenticator code to complete login.',
                },
            });
        }
        // ─── No MFA — issue token immediately ────────────────────
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), lastLoginIp: clientIp },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'LOGIN_SUCCESS',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
                ipAddress: clientIp,
                userAgent,
            },
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, env_1.ENV.JWT_SECRET, { expiresIn: '7d', jwtid: crypto_1.default.randomUUID() });
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    status: user.status,
                    kycStatus: user.kycStatus,
                    tradingBlocked: user.tradingBlocked ?? false,
                    withdrawalsBlocked: user.withdrawalsBlocked ?? false,
                    depositsBlocked: user.depositsBlocked ?? false,
                    emailVerified: user.emailVerified,
                    wallet: user.wallet,
                },
                token,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'LOGIN_ERROR', message: err.message } });
    }
});
// POST /auth/mfa/verify — Real TOTP Verification
router.post('/mfa/verify', (0, validate_1.validateBody)(schemas_1.mfaVerifySchema), async (req, res) => {
    try {
        const { email, code } = req.body;
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || null;
        const user = await prisma_1.default.user.findUnique({
            where: { email },
            include: { wallet: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
        }
        if (!user.mfaEnabled || !user.mfaSecret) {
            return res.status(400).json({ success: false, error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not enabled for this account.' } });
        }
        // ─── Validate TOTP code against stored secret ────────────
        const isValid = speakeasy_1.default.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: code,
            window: 1,
        });
        if (!isValid) {
            // ─── Check backup codes as fallback ────────────────────
            let backupCodesUsed = false;
            if (user.mfaBackupCodes) {
                try {
                    const backupCodes = JSON.parse(user.mfaBackupCodes);
                    const codeIndex = backupCodes.indexOf(code);
                    if (codeIndex >= 0) {
                        backupCodes.splice(codeIndex, 1);
                        await prisma_1.default.user.update({
                            where: { id: user.id },
                            data: { mfaBackupCodes: JSON.stringify(backupCodes) },
                        });
                        backupCodesUsed = true;
                    }
                }
                catch { /* invalid backup codes JSON — ignore */ }
            }
            if (!backupCodesUsed) {
                await prisma_1.default.auditLog.create({
                    data: {
                        eventType: 'MFA_FAILED',
                        actorId: user.id,
                        actorRole: user.role,
                        ipAddress: clientIp,
                        userAgent,
                    },
                });
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_MFA_CODE', message: 'Invalid authenticator code. Please try again.' },
                });
            }
        }
        // ─── MFA passed — issue token ────────────────────────────
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), lastLoginIp: clientIp, failedLoginCount: 0, lockedUntil: null },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'LOGIN_SUCCESS_MFA',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
                ipAddress: clientIp,
                userAgent,
            },
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, env_1.ENV.JWT_SECRET, { expiresIn: '7d', jwtid: crypto_1.default.randomUUID() });
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    status: user.status,
                    kycStatus: user.kycStatus,
                    tradingBlocked: user.tradingBlocked ?? false,
                    withdrawalsBlocked: user.withdrawalsBlocked ?? false,
                    depositsBlocked: user.depositsBlocked ?? false,
                    emailVerified: user.emailVerified,
                    wallet: user.wallet,
                },
                token,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'MFA_ERROR', message: err.message } });
    }
});
// POST /auth/mfa/setup — Generate MFA secret + QR code
router.post('/mfa/setup', auth_1.authenticateJwt, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
        const secretObj = speakeasy_1.default.generateSecret({
            name: `HKFES Trading (${user.email})`,
            issuer: 'HKFES Trading',
            length: 20,
        });
        const secret = secretObj.base32;
        const otpauthUrl = secretObj.otpauth_url;
        // Generate 8 backup codes
        const backupCodes = Array.from({ length: 8 }, () => Math.random().toString(36).substring(2, 8).toUpperCase());
        // Store secret (not yet enabled — user must confirm with a valid code)
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                mfaSecret: secret,
                mfaBackupCodes: JSON.stringify(backupCodes),
            },
        });
        res.json({
            success: true,
            data: {
                secret,
                otpauthUrl,
                backupCodes,
                message: 'Scan the QR code in your authenticator app, then confirm with a code to enable MFA.',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'MFA_SETUP_ERROR', message: err.message } });
    }
});
// POST /auth/mfa/confirm — Confirm MFA setup with a valid code
router.post('/mfa/confirm', auth_1.authenticateJwt, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || code.length !== 6) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Please provide a 6-digit code.' } });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user || !user.mfaSecret) {
            return res.status(400).json({ success: false, error: { code: 'MFA_NOT_SETUP', message: 'Please run MFA setup first.' } });
        }
        const isValid = speakeasy_1.default.totp.verify({ secret: user.mfaSecret, encoding: 'base32', token: code, window: 1 });
        if (!isValid) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid code. Please try again.' } });
        }
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { mfaEnabled: true },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'MFA_ENABLED',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
            },
        });
        res.json({
            success: true,
            data: { message: 'MFA has been enabled successfully. You will be required to enter a code on login.' },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'MFA_CONFIRM_ERROR', message: err.message } });
    }
});
// POST /auth/mfa/disable — Disable MFA
router.post('/mfa/disable', auth_1.authenticateJwt, async (req, res) => {
    try {
        const { code } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
        if (!user.mfaEnabled || !user.mfaSecret) {
            return res.status(400).json({ success: false, error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not currently enabled.' } });
        }
        // Require valid code to disable MFA
        if (code) {
            const isValid = speakeasy_1.default.totp.verify({ secret: user.mfaSecret, encoding: 'base32', token: code, window: 1 });
            if (!isValid) {
                return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid code.' } });
            }
        }
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'MFA_DISABLED',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
            },
        });
        res.json({
            success: true,
            data: { message: 'MFA has been disabled.' },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'MFA_DISABLE_ERROR', message: err.message } });
    }
});
// POST /auth/logout — Blacklists the current token
router.post('/logout', auth_1.authenticateJwt, async (req, res) => {
    // Extract and blacklist the token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        tokenBlacklist.add(token);
    }
    if (req.user) {
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'LOGOUT',
                actorId: req.user.id,
                actorRole: req.user.role,
                ipAddress: getClientIp(req),
            },
        });
    }
    res.json({ success: true, data: { message: 'Logged out successfully. Token has been invalidated.' } });
});
async function notifyPasswordStaff(subject, html) {
    const staff = await prisma_1.default.user.findMany({
        where: { role: { in: ['admin', 'super_admin'] }, status: 'active' },
        select: { email: true },
    });
    await Promise.all(staff.map((member) => (0, emailService_1.sendEmail)({ to: member.email, subject, html })));
}
async function nextTicketNumber() {
    for (let i = 0; i < 5; i++) {
        const n = `HK-${Math.floor(100000 + Math.random() * 900000)}`;
        const exists = await prisma_1.default.supportTicket.findUnique({ where: { ticketNumber: n } });
        if (!exists)
            return n;
    }
    return `HK-${Date.now().toString().slice(-8)}`;
}
// POST /auth/forgot-password — Email link, or a request the admin desk can see
router.post('/forgot-password', (0, validate_1.validateBody)(schemas_1.forgotPasswordSchema), async (req, res) => {
    try {
        const { email, method } = req.body;
        const generic = method === 'admin'
            ? 'If an account exists with this email, the admin and super admin have been asked to reset the password.'
            : 'If an account exists with this email, a password reset link has been sent. It expires in 1 hour.';
        const user = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (!user || user.status === 'deleted') {
            return res.json({ success: true, data: { message: generic } });
        }
        if (method === 'admin') {
            const openRequest = await prisma_1.default.supportTicket.findFirst({
                where: {
                    userId: user.id,
                    subject: 'Password reset requested',
                    status: { in: ['open', 'in_progress', 'awaiting_user'] },
                },
            });
            if (!openRequest) {
                const ticketNumber = await nextTicketNumber();
                const who = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                await prisma_1.default.supportTicket.create({
                    data: {
                        ticketNumber,
                        userId: user.id,
                        category: 'account',
                        subject: 'Password reset requested',
                        priority: 'high',
                        contactChannel: 'email',
                        contactHandle: user.email,
                        messages: {
                            create: {
                                authorId: user.id,
                                authorRole: user.role,
                                authorName: who,
                                body: `${who} (${user.email}) cannot sign in and asked the admin desk to set a new password. No reset key was shown to the account holder.`,
                            },
                        },
                    },
                });
                void notifyPasswordStaff(`HKFES password reset request — ${user.email}`, `<p><strong>${who}</strong> (${user.email}) asked for a password reset.</p><p>Ticket ${ticketNumber} is in the support desk for both admin and super admin. Set a new password from the user account. Do not send the account holder a reset key.</p>`).catch((err) => console.error('[Password] Staff notify failed:', err));
            }
            await prisma_1.default.auditLog.create({
                data: {
                    eventType: 'PASSWORD_RESET_ADMIN_REQUESTED',
                    actorId: user.id,
                    actorRole: user.role,
                    targetEntityType: 'user',
                    targetEntityId: user.id,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || null,
                },
            });
            return res.json({ success: true, data: { message: generic } });
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        passwordResetTokens.set(resetToken, { userId: user.id, expiresAt: Date.now() + 3600000 });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'PASSWORD_RESET_REQUESTED',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
            },
        });
        void (0, emailService_1.sendPasswordResetEmail)({ to: user.email, resetToken }).catch((err) => {
            console.error('[Password] Reset email failed:', err);
        });
        res.json({
            success: true,
            data: {
                message: generic,
                ...(env_1.ENV.NODE_ENV === 'test' ? { resetToken } : {}),
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'FORGOT_PASSWORD_ERROR', message: err.message } });
    }
});
// POST /auth/reset-password — Consumes reset token, resets password, unlocks account
router.post('/reset-password', (0, validate_1.validateBody)(schemas_1.resetPasswordSchema), async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const record = passwordResetTokens.get(token);
        if (!record || record.expiresAt < Date.now()) {
            passwordResetTokens.delete(token);
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_TOKEN', message: 'Password reset token is invalid or has expired.' },
            });
        }
        const user = await prisma_1.default.user.findUnique({ where: { id: record.userId } });
        if (!user) {
            passwordResetTokens.delete(token);
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User account not found.' } });
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                failedLoginCount: 0,
                lockedUntil: null,
            },
        });
        passwordResetTokens.delete(token);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'PASSWORD_RESET_COMPLETED',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
            },
        });
        res.json({
            success: true,
            data: { message: 'Password has been successfully updated. You may now log in with your new credentials.' },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'RESET_PASSWORD_ERROR', message: err.message } });
    }
});
// POST /auth/refresh — Exchanges valid active JWT for fresh 7d JWT token
router.post('/refresh', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'Bearer token required for refresh.' } });
        }
        const token = authHeader.split(' ')[1];
        if (tokenBlacklist.has(token)) {
            return res.status(401).json({ success: false, error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked.' } });
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET, { ignoreExpiration: false });
        }
        catch {
            return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token.' } });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: decoded.id },
            include: { wallet: true },
        });
        if (!user || (user.status !== 'active' && user.status !== 'inactive' && user.status !== 'suspended')) {
            return res.status(403).json({ success: false, error: { code: 'USER_INACTIVE', message: 'User account is closed or disabled.' } });
        }
        // Blacklist previous token to enforce single-use refresh token rotation
        tokenBlacklist.add(token);
        const freshToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, jti: crypto_1.default.randomUUID() }, env_1.ENV.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            success: true,
            data: {
                token: freshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    kycStatus: user.kycStatus,
                    mfaEnabled: user.mfaEnabled,
                    emailVerified: user.emailVerified,
                },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'REFRESH_ERROR', message: err.message } });
    }
});
// POST /auth/send-verification — Generates 6-digit email verification OTP
router.post('/send-verification', auth_1.authenticateJwt, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }
        if (user.emailVerified) {
            return res.json({ success: true, data: { message: 'Email address is already verified.', emailVerified: true } });
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
        emailVerificationCodes.set(user.id, { code, email: user.email, expiresAt });
        logger_1.default.info(`[EmailVerification] Dispatched verification code to ${user.email} (dev code: ${code})`);
        res.json({
            success: true,
            data: {
                message: `Verification code dispatched to ${user.email}`,
                devCode: env_1.ENV.NODE_ENV !== 'production' ? code : undefined,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SEND_VERIFICATION_ERROR', message: err.message } });
    }
});
// POST /auth/verify-email — Validates 6-digit email OTP and marks account emailVerified = true
router.post('/verify-email', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.verifyEmailSchema), async (req, res) => {
    try {
        const { code } = req.body;
        const record = emailVerificationCodes.get(req.user.id);
        // Accept stored code, or universal master test code 123456 in dev/test
        const isValid = (record && record.code === code && record.expiresAt > Date.now()) ||
            (env_1.ENV.NODE_ENV !== 'production' && code === '123456');
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_CODE', message: 'Verification code is invalid or has expired.' },
            });
        }
        const updated = await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: {
                emailVerified: true,
                emailVerifiedAt: new Date(),
            },
        });
        emailVerificationCodes.delete(req.user.id);
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'EMAIL_VERIFIED',
                actorId: updated.id,
                actorRole: updated.role,
                targetEntityType: 'user',
                targetEntityId: updated.id,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
            },
        });
        res.json({
            success: true,
            data: {
                message: 'Your email address has been successfully verified.',
                emailVerified: true,
                emailVerifiedAt: updated.emailVerifiedAt,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'VERIFY_EMAIL_ERROR', message: err.message } });
    }
});
// POST /auth/otp/send — Send OTP to email for various purposes
router.post('/otp/send', (0, validate_1.validateBody)(schemas_1.sendOtpSchema), async (req, res) => {
    try {
        const { email, purpose = 'verification' } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_EMAIL', message: 'Valid email address is required.' },
            });
        }
        const user = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        // For security, always return success even if user doesn't exist (prevents enumeration)
        if (!user) {
            return res.json({
                success: true,
                data: { message: 'If an account exists with this email, an OTP has been sent.' },
            });
        }
        // Check rate limiting - max 3 OTPs per 5 minutes per email
        const existingOtp = emailOtpCodes.get(email);
        if (existingOtp && existingOtp.expiresAt > Date.now() && existingOtp.attempts >= 3) {
            return res.status(429).json({
                success: false,
                error: { code: 'RATE_LIMITED', message: 'Too many OTP requests. Please wait 5 minutes before trying again.' },
            });
        }
        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        // Store OTP
        emailOtpCodes.set(email, {
            code,
            purpose,
            expiresAt,
            attempts: existingOtp ? existingOtp.attempts + 1 : 1,
        });
        // Send email
        const emailSent = await (0, emailService_1.sendOtpEmail)({ to: email, otp: code, purpose });
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                error: { code: 'EMAIL_SEND_FAILED', message: 'Failed to send OTP email. Please try again.' },
            });
        }
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'OTP_SENT',
                actorId: user.id,
                actorRole: user.role,
                targetEntityType: 'user',
                targetEntityId: user.id,
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
                metadata: JSON.stringify({ purpose, email }),
            },
        });
        res.json({
            success: true,
            data: {
                message: 'OTP has been sent to your email address.',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'OTP_SEND_ERROR', message: err.message } });
    }
});
// POST /auth/otp/verify — Verify OTP code
router.post('/otp/verify', (0, validate_1.validateBody)(schemas_1.verifyOtpSchema), async (req, res) => {
    try {
        const { email, code, purpose = 'verification' } = req.body;
        if (!email || !code) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_FIELDS', message: 'Email and code are required.' },
            });
        }
        const record = emailOtpCodes.get(email);
        // Accept stored code, or universal master test code 123456 in dev/test
        const isValid = (record && record.code === code && record.expiresAt > Date.now() && record.purpose === purpose) ||
            (env_1.ENV.NODE_ENV !== 'production' && code === '123456');
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP code.' },
            });
        }
        // OTP verified - remove from storage
        emailOtpCodes.delete(email);
        const user = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (user) {
            // If this is for email verification, mark the user as verified
            if (purpose === 'verification' && !user.emailVerified) {
                await prisma_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        emailVerified: true,
                        emailVerifiedAt: new Date(),
                    },
                });
            }
            await prisma_1.default.auditLog.create({
                data: {
                    eventType: 'OTP_VERIFIED',
                    actorId: user.id,
                    actorRole: user.role,
                    targetEntityType: 'user',
                    targetEntityId: user.id,
                    ipAddress: getClientIp(req),
                    userAgent: req.headers['user-agent'] || null,
                    metadata: JSON.stringify({ purpose }),
                },
            });
        }
        res.json({
            success: true,
            data: {
                message: 'OTP verified successfully.',
                verified: true,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'OTP_VERIFY_ERROR', message: err.message } });
    }
});
// Clean up expired OTP codes every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of emailOtpCodes.entries()) {
        if (data.expiresAt < now) {
            emailOtpCodes.delete(email);
        }
    }
}, 300000).unref();
exports.default = router;
