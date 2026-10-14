"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const isProduction = process.env.NODE_ENV === 'production';
// Fail-fast: JWT_SECRET must be strong and explicitly configured in production
const jwtSecret = process.env.JWT_SECRET;
if (isProduction) {
    if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes('dev-only') || jwtSecret.includes('change-in-production')) {
        console.error('FATAL: In production, JWT_SECRET must be set to a strong random key at least 32 characters long. Refusing to start.');
        process.exit(1);
    }
}
exports.ENV = {
    PORT: parseInt(process.env.PORT || '4000', 10),
    WS_PORT: parseInt(process.env.WS_PORT || '4001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
    JWT_SECRET: jwtSecret || 'dev-only-fallback-key-never-use-in-prod',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    // Rate limiting
    RATE_LIMIT_AUTH_MAX: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10),
    RATE_LIMIT_AUTH_WINDOW_MS: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '60000', 10),
    RATE_LIMIT_API_MAX: parseInt(process.env.RATE_LIMIT_API_MAX || '100', 10),
    RATE_LIMIT_API_WINDOW_MS: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
    // Account lockout
    MAX_FAILED_LOGIN_ATTEMPTS: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5', 10),
    ACCOUNT_LOCKOUT_MINUTES: parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES || '15', 10),
    // Email service configuration
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'console', // 'console', 'gmail', 'smtp', 'sendgrid', 'mailgun', 'mailtrap'
    EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@hkfes-trading.com',
    EMAIL_USER: process.env.EMAIL_USER || '',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
    // SMTP configuration (for custom SMTP)
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: process.env.SMTP_PORT || '587',
    SMTP_SECURE: process.env.SMTP_SECURE || 'false',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
    // SendGrid configuration
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
    // Mailgun configuration
    MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
    MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || '',
    // Mailtrap configuration
    MAILTRAP_API_TOKEN: process.env.MAILTRAP_API_TOKEN || '',
    // Frontend URL for password reset links
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
