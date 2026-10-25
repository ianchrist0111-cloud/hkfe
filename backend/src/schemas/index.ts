import { z } from 'zod';

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional(),
});

export const mfaVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  method: z.enum(['email', 'admin']).default('email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyEmailSchema = z.object({
  code: z.string().min(4, 'Verification code is required').max(10),
});

// OTP Schemas
export const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  purpose: z.enum(['verification', 'login', 'withdrawal', 'password_reset']).optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'OTP must be 6 digits'),
  purpose: z.enum(['verification', 'login', 'withdrawal', 'password_reset']).optional(),
});

// KYC Schemas
const isAdult = (dob: string) => {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return false;
  const eighteen = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
  return eighteen <= new Date();
};

export const kycPersonalDetailsSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  dateOfBirth: z.string().min(8, 'Date of birth is required').refine(isAdult, 'You must be at least 18 years old'),
  phoneNumber: z.string().trim().min(6, 'Phone number is required').max(30),
  nationality: z.string().trim().min(2).max(60).optional(),
  occupation: z.string().trim().max(80).optional(),
  sourceOfFunds: z.string().trim().max(80).optional(),
});

export const kycAddressSchema = z.object({
  addressLine1: z.string().trim().min(3, 'Street address is required'),
  addressLine2: z.string().optional(),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().min(1, 'State / region is required'),
  zipCode: z.string().trim().min(3, 'Postal code is required'),
  country: z.string().trim().min(2).default('US'),
});

const MAX_IMAGE_CHARS = 3_000_000; // ~2.2MB binary after base64 overhead

export const kycDocumentSchema = z.object({
  documentType: z.enum(['passport', 'drivers_license', 'national_id']),
  documentNumber: z.string().trim().min(4, 'Document number is required').max(40),
  documentExpiry: z.string().optional(),
  documentRef: z.string().min(1, 'Front of document is required').max(MAX_IMAGE_CHARS),
  documentBackRef: z.string().max(MAX_IMAGE_CHARS).optional(),
  selfieRef: z.string().min(1, 'Selfie verification is required').max(MAX_IMAGE_CHARS),
  consent: z.literal(true, { errorMap: () => ({ message: 'You must confirm the declaration' }) }),
});

export const adminKycReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().trim().max(500).optional(),
});

// Support Schemas
export const supportCategories = ['account', 'kyc', 'deposit', 'withdrawal', 'trading', 'technical', 'other'] as const;

export const createSupportTicketSchema = z.object({
  category: z.enum(supportCategories),
  subject: z.string().trim().min(4, 'Subject must be at least 4 characters').max(120),
  message: z.string().trim().min(10, 'Please describe your issue (min 10 characters)').max(4000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  contactChannel: z.enum(['in_app', 'email', 'telegram']).default('in_app'),
  contactHandle: z.string().trim().max(80).optional(),
});

export const supportMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
  isInternal: z.boolean().optional(),
});

export const adminUpdateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'awaiting_user', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignToMe: z.boolean().optional(),
});

// Wallet Schemas
export const depositSchema = z.object({
  amount: z.number().positive('Deposit amount must be positive'),
  method: z.string().default('card'),
  currency: z.string().default('USD'),
});

export const withdrawSchema = z.object({
  amount: z.number().positive('Withdrawal amount must be positive'),
  destination: z.string().min(1),
  method: z.string().default('bank'),
  twoFactorCode: z.string().optional(),
});


export const walletTransferSchema = z.object({
  from: z.enum(['available', 'trading', 'earn', 'bots']),
  to: z.enum(['available', 'trading', 'earn', 'bots']),
  amount: z.number().positive('Transfer amount must be positive'),
}).refine(data => data.from !== data.to, { message: 'Source and destination sub-wallets must be different' });


// Trading Schemas
export const placeOrderSchema = z.object({
  symbol: z.string().min(1),
  direction: z.enum(['buy', 'sell']),
  orderType: z.enum(['market', 'limit', 'stop']),
  sizeUsd: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
});

export const closePositionSchema = z.object({
  percentage: z.number().min(1).max(100).default(100),
});

export const placeShortTermOptionSchema = z.object({
  symbol: z.string().min(1),
  direction: z.enum(['call', 'put', 'buy', 'sell']),
  durationSeconds: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120), z.number().int().min(10).max(600)]),
  amount: z.number().positive('Investment amount must be positive'),
  payoutRate: z.number().min(0.5).max(1.0).optional().default(0.90),
});

export const settleShortTermOptionSchema = z.object({
  contractId: z.string().min(1),
  exitPrice: z.number().positive().optional(),
});

// Strategy / Service Schemas
export const subscribeStrategySchema = z.object({
  allocatedUsd: z.number().positive('Allocation must be greater than 0'),
  config: z.record(z.any()).optional(),
});

// Admin Schemas
export const adminSetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  kycStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  tradingBlocked: z.boolean().optional(),
  withdrawalsBlocked: z.boolean().optional(),
  depositsBlocked: z.boolean().optional(),
});

export const adminResetBalanceSchema = z.object({
  newBalance: z.number().positive().default(10000),
  reason: z.string().optional(),
});

export const adminSpikeSchema = z.object({
  symbol: z.string().optional(),
  magnitudePercent: z.number().default(5.0),
  direction: z.enum(['up', 'down', 'random']).default('random'),
});
