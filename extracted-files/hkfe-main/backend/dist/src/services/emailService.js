"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeEmailTransporter = initializeEmailTransporter;
exports.sendEmail = sendEmail;
exports.sendOtpEmail = sendOtpEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const mailtrap_1 = require("mailtrap");
const env_1 = require("../config/env");
const logger_1 = __importDefault(require("../utils/logger"));
// Email transporter (configured based on environment)
let transporter = null;
/**
 * Initialize email transporter
 * Supports multiple providers: Gmail, SendGrid, SMTP, etc.
 */
function initializeEmailTransporter() {
    logger_1.default.info(`[Email Service] Initializing with provider: ${env_1.ENV.EMAIL_SERVICE}`);
    if (env_1.ENV.EMAIL_SERVICE === 'mailtrap') {
        // Mailtrap (recommended for testing)
        if (!env_1.ENV.MAILTRAP_API_TOKEN) {
            logger_1.default.warn('[Email Service] Mailtrap API token not configured. Falling back to console mode.');
            return;
        }
        transporter = nodemailer_1.default.createTransport((0, mailtrap_1.MailtrapTransport)({
            token: env_1.ENV.MAILTRAP_API_TOKEN,
        }));
        logger_1.default.info('[Email Service] Mailtrap configured successfully');
    }
    else if (env_1.ENV.EMAIL_SERVICE === 'gmail') {
        // Gmail SMTP
        transporter = nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: env_1.ENV.EMAIL_USER,
                pass: env_1.ENV.EMAIL_PASSWORD,
            },
        });
        logger_1.default.info('[Email Service] Gmail SMTP configured');
    }
    else if (env_1.ENV.EMAIL_SERVICE === 'smtp') {
        // Custom SMTP
        logger_1.default.info(`[Email Service] SMTP configured: ${env_1.ENV.SMTP_HOST}:${env_1.ENV.SMTP_PORT}`);
        transporter = nodemailer_1.default.createTransport({
            host: env_1.ENV.SMTP_HOST,
            port: parseInt(env_1.ENV.SMTP_PORT || '587'),
            secure: env_1.ENV.SMTP_SECURE === 'true',
            auth: {
                user: env_1.ENV.SMTP_USER,
                pass: env_1.ENV.SMTP_PASSWORD,
            },
        });
        logger_1.default.info('[Email Service] SMTP transporter created successfully');
    }
    else if (env_1.ENV.EMAIL_SERVICE === 'sendgrid') {
        // SendGrid
        transporter = nodemailer_1.default.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
                user: 'apikey',
                pass: env_1.ENV.SENDGRID_API_KEY,
            },
        });
        logger_1.default.info('[Email Service] SendGrid configured');
    }
    else if (env_1.ENV.EMAIL_SERVICE === 'mailgun') {
        // Mailgun
        transporter = nodemailer_1.default.createTransport({
            host: `smtp.mailgun.org`,
            port: 587,
            secure: false,
            auth: {
                user: env_1.ENV.MAILGUN_API_KEY,
                pass: env_1.ENV.MAILGUN_DOMAIN,
            },
        });
        logger_1.default.info('[Email Service] Mailgun configured');
    }
    else {
        // Development/Test mode - log emails to console
        logger_1.default.warn('Email service not configured. Emails will be logged to console only.');
    }
}
/**
 * Send an email
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content
 * @param text - Plain text content (fallback)
 */
async function sendEmail({ to, subject, html, text, }) {
    try {
        if (!transporter) {
            // Log email in development/test mode
            logger_1.default.info(`[EMAIL - DEV MODE] To: ${to}, Subject: ${subject}`);
            logger_1.default.info(`[EMAIL - DEV MODE] HTML: ${html.substring(0, 200)}...`);
            return true;
        }
        const from = env_1.ENV.EMAIL_SERVICE === 'mailtrap'
            ? { address: env_1.ENV.EMAIL_FROM, name: 'HKFES Trading' }
            : env_1.ENV.EMAIL_FROM || 'noreply@hkfes-trading.com';
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
        });
        logger_1.default.info(`Email sent to ${to}: ${subject} (${info.messageId})`);
        return true;
    }
    catch (error) {
        logger_1.default.error(`Failed to send email to ${to} (${subject}): ${error.message}`);
        return false;
    }
}
/**
 * Send OTP verification email
 * @param to - Recipient email address
 * @param otp - 6-digit OTP code
 * @param purpose - Purpose of OTP (e.g., 'login', 'verification', 'withdrawal')
 */
async function sendOtpEmail({ to, otp, purpose = 'verification', }) {
    const purposeText = {
        login: 'login authentication',
        verification: 'email verification',
        withdrawal: 'withdrawal confirmation',
        password_reset: 'password reset',
    }[purpose] || 'verification';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #00e599 0%, #00b4d8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: #07090e; margin: 0; font-size: 24px;">HKFES Trading</h1>
        <p style="color: #07090e; margin: 5px 0 0; opacity: 0.9;">Your Verification Code</p>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          You requested a ${purposeText} code for your HKFES Trading account.
        </p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #00e599;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          This code will expire in <strong>10 minutes</strong>. Please do not share this code with anyone.
        </p>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          If you did not request this code, please ignore this email and ensure your account is secure.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          This is an automated message from HKFES Trading. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
    const text = `
    HKFES Trading - Your Verification Code

    You requested a ${purposeText} code for your HKFES Trading account.

    Your code is: ${otp}

    This code will expire in 10 minutes. Please do not share this code with anyone.

    If you did not request this code, please ignore this email and ensure your account is secure.

    ---
    This is an automated message from HKFES Trading. Please do not reply to this email.
  `;
    logger_1.default.info(`[EMAIL OTP] To: ${to}, Code: ${otp}, Purpose: ${purpose}`);
    return sendEmail({
        to,
        subject: `HKFES Trading - Your Verification Code`,
        html,
        text,
    });
}
/**
 * Send password reset email
 * @param to - Recipient email address
 * @param resetToken - Password reset token
 */
async function sendPasswordResetEmail({ to, resetToken, }) {
    const resetUrl = `${env_1.ENV.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #00e599 0%, #00b4d8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: #07090e; margin: 0; font-size: 24px;">HKFES Trading</h1>
        <p style="color: #07090e; margin: 5px 0 0; opacity: 0.9;">Password Reset Request</p>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          We received a request to reset the password for your HKFES Trading account.
        </p>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          Click the button below to reset your password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #00e599 0%, #00b4d8 100%); color: #07090e; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          This link will expire in <strong>1 hour</strong>. If you did not request this password reset, please ignore this email and ensure your account is secure.
        </p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          This is an automated message from HKFES Trading. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
    const text = `
    HKFES Trading - Password Reset Request
    
    We received a request to reset the password for your HKFES Trading account.
    
    Click the link below to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour. If you did not request this password reset, please ignore this email and ensure your account is secure.
    
    ---
    This is an automated message from HKFES Trading. Please do not reply to this email.
  `;
    return sendEmail({
        to,
        subject: 'HKFES Trading - Password Reset Request',
        html,
        text,
    });
}
// Initialize email transporter on module load
initializeEmailTransporter();
