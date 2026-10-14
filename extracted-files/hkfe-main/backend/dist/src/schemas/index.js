"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSpikeSchema = exports.adminResetBalanceSchema = exports.adminUpdateUserSchema = exports.adminSetPasswordSchema = exports.subscribeStrategySchema = exports.settleShortTermOptionSchema = exports.placeShortTermOptionSchema = exports.closePositionSchema = exports.placeOrderSchema = exports.walletTransferSchema = exports.withdrawSchema = exports.depositSchema = exports.adminUpdateTicketSchema = exports.supportMessageSchema = exports.createSupportTicketSchema = exports.supportCategories = exports.adminKycReviewSchema = exports.kycDocumentSchema = exports.kycAddressSchema = exports.kycPersonalDetailsSchema = exports.verifyOtpSchema = exports.sendOtpSchema = exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.mfaVerifySchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Auth Schemas
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    mfaCode: zod_1.z.string().optional(),
});
exports.mfaVerifySchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string().length(6),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    method: zod_1.z.enum(['email', 'admin']).default('email'),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token is required'),
    newPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.verifyEmailSchema = zod_1.z.object({
    code: zod_1.z.string().min(4, 'Verification code is required').max(10),
});
// OTP Schemas
exports.sendOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    purpose: zod_1.z.enum(['verification', 'login', 'withdrawal', 'password_reset']).optional(),
});
exports.verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    code: zod_1.z.string().length(6, 'OTP must be 6 digits'),
    purpose: zod_1.z.enum(['verification', 'login', 'withdrawal', 'password_reset']).optional(),
});
// KYC Schemas
const isAdult = (dob) => {
    const d = new Date(dob);
    if (Number.isNaN(d.getTime()))
        return false;
    const eighteen = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
    return eighteen <= new Date();
};
exports.kycPersonalDetailsSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(1, 'First name is required').max(60),
    lastName: zod_1.z.string().trim().min(1, 'Last name is required').max(60),
    dateOfBirth: zod_1.z.string().min(8, 'Date of birth is required').refine(isAdult, 'You must be at least 18 years old'),
    phoneNumber: zod_1.z.string().trim().min(6, 'Phone number is required').max(30),
    nationality: zod_1.z.string().trim().min(2).max(60).optional(),
    occupation: zod_1.z.string().trim().max(80).optional(),
    sourceOfFunds: zod_1.z.string().trim().max(80).optional(),
});
exports.kycAddressSchema = zod_1.z.object({
    addressLine1: zod_1.z.string().trim().min(3, 'Street address is required'),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().trim().min(1, 'City is required'),
    state: zod_1.z.string().trim().min(1, 'State / region is required'),
    zipCode: zod_1.z.string().trim().min(3, 'Postal code is required'),
    country: zod_1.z.string().trim().min(2).default('US'),
});
const MAX_IMAGE_CHARS = 3_000_000; // ~2.2MB binary after base64 overhead
exports.kycDocumentSchema = zod_1.z.object({
    documentType: zod_1.z.enum(['passport', 'drivers_license', 'national_id']),
    documentNumber: zod_1.z.string().trim().min(4, 'Document number is required').max(40),
    documentExpiry: zod_1.z.string().optional(),
    documentRef: zod_1.z.string().min(1, 'Front of document is required').max(MAX_IMAGE_CHARS),
    documentBackRef: zod_1.z.string().max(MAX_IMAGE_CHARS).optional(),
    selfieRef: zod_1.z.string().min(1, 'Selfie verification is required').max(MAX_IMAGE_CHARS),
    consent: zod_1.z.literal(true, { errorMap: () => ({ message: 'You must confirm the declaration' }) }),
});
exports.adminKycReviewSchema = zod_1.z.object({
    decision: zod_1.z.enum(['approved', 'rejected']),
    notes: zod_1.z.string().trim().max(500).optional(),
});
// Support Schemas
exports.supportCategories = ['account', 'kyc', 'deposit', 'withdrawal', 'trading', 'technical', 'other'];
exports.createSupportTicketSchema = zod_1.z.object({
    category: zod_1.z.enum(exports.supportCategories),
    subject: zod_1.z.string().trim().min(4, 'Subject must be at least 4 characters').max(120),
    message: zod_1.z.string().trim().min(10, 'Please describe your issue (min 10 characters)').max(4000),
    priority: zod_1.z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    contactChannel: zod_1.z.enum(['in_app', 'email', 'telegram']).default('in_app'),
    contactHandle: zod_1.z.string().trim().max(80).optional(),
});
exports.supportMessageSchema = zod_1.z.object({
    body: zod_1.z.string().trim().min(1, 'Message cannot be empty').max(4000),
    isInternal: zod_1.z.boolean().optional(),
});
exports.adminUpdateTicketSchema = zod_1.z.object({
    status: zod_1.z.enum(['open', 'in_progress', 'awaiting_user', 'resolved', 'closed']).optional(),
    priority: zod_1.z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    assignToMe: zod_1.z.boolean().optional(),
});
// Wallet Schemas
exports.depositSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Deposit amount must be positive'),
    method: zod_1.z.string().default('card'),
    currency: zod_1.z.string().default('USD'),
});
exports.withdrawSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Withdrawal amount must be positive'),
    destination: zod_1.z.string().min(1),
    method: zod_1.z.string().default('bank'),
    twoFactorCode: zod_1.z.string().optional(),
});
exports.walletTransferSchema = zod_1.z.object({
    from: zod_1.z.enum(['available', 'trading', 'earn', 'bots']),
    to: zod_1.z.enum(['available', 'trading', 'earn', 'bots']),
    amount: zod_1.z.number().positive('Transfer amount must be positive'),
}).refine(data => data.from !== data.to, { message: 'Source and destination sub-wallets must be different' });
// Trading Schemas
exports.placeOrderSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1),
    direction: zod_1.z.enum(['buy', 'sell']),
    orderType: zod_1.z.enum(['market', 'limit', 'stop']),
    sizeUsd: zod_1.z.number().positive(),
    limitPrice: zod_1.z.number().positive().optional(),
    stopLoss: zod_1.z.number().positive().optional(),
    takeProfit: zod_1.z.number().positive().optional(),
});
exports.closePositionSchema = zod_1.z.object({
    percentage: zod_1.z.number().min(1).max(100).default(100),
});
exports.placeShortTermOptionSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1),
    direction: zod_1.z.enum(['call', 'put', 'buy', 'sell']),
    durationSeconds: zod_1.z.union([zod_1.z.literal(30), zod_1.z.literal(60), zod_1.z.literal(90), zod_1.z.literal(120), zod_1.z.number().int().min(10).max(600)]),
    amount: zod_1.z.number().positive('Investment amount must be positive'),
    payoutRate: zod_1.z.number().min(0.5).max(1.0).optional().default(0.90),
});
exports.settleShortTermOptionSchema = zod_1.z.object({
    contractId: zod_1.z.string().min(1),
    exitPrice: zod_1.z.number().positive().optional(),
});
// Strategy / Service Schemas
exports.subscribeStrategySchema = zod_1.z.object({
    allocatedUsd: zod_1.z.number().positive('Allocation must be greater than 0'),
    config: zod_1.z.record(zod_1.z.any()).optional(),
});
// Admin Schemas
exports.adminSetPasswordSchema = zod_1.z.object({
    newPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.adminUpdateUserSchema = zod_1.z.object({
    role: zod_1.z.enum(['user', 'admin', 'super_admin']).optional(),
    status: zod_1.z.enum(['active', 'suspended', 'deleted']).optional(),
    kycStatus: zod_1.z.enum(['pending', 'approved', 'rejected']).optional(),
    tradingBlocked: zod_1.z.boolean().optional(),
    withdrawalsBlocked: zod_1.z.boolean().optional(),
    depositsBlocked: zod_1.z.boolean().optional(),
});
exports.adminResetBalanceSchema = zod_1.z.object({
    newBalance: zod_1.z.number().positive().default(10000),
    reason: zod_1.z.string().optional(),
});
exports.adminSpikeSchema = zod_1.z.object({
    symbol: zod_1.z.string().optional(),
    magnitudePercent: zod_1.z.number().default(5.0),
    direction: zod_1.z.enum(['up', 'down', 'random']).default('random'),
});
