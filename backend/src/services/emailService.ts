import nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { ENV } from '../config/env';
import logger from '../utils/logger';

// Email transporter (configured based on environment)
let transporter: any = null;

/**
 * Initialize email transporter
 * Supports multiple providers: Gmail, SendGrid, SMTP, etc.
 */
export function initializeEmailTransporter() {
  logger.info(`[Email Service] Initializing with provider: ${ENV.EMAIL_SERVICE}`);

  if (ENV.EMAIL_SERVICE === 'gmail') {
  const {
    EMAIL_USER,
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
  } = ENV;

  if (
    !EMAIL_USER ||
    !GMAIL_CLIENT_ID ||
    !GMAIL_CLIENT_SECRET ||
    !GMAIL_REFRESH_TOKEN
  ) {
    throw new Error(
      'Gmail OAuth2 configuration is incomplete. Check backend environment variables.'
    );
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: EMAIL_USER,
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
    },
  });
}
 else if (ENV.EMAIL_SERVICE === 'mailtrap') {
    // Mailtrap (recommended for testing)
    if (!ENV.MAILTRAP_API_TOKEN) {
      logger.warn('[Email Service] Mailtrap API token not configured. Falling back to console mode.');
      return;
    }
    transporter = nodemailer.createTransport(
      MailtrapTransport({
        token: ENV.MAILTRAP_API_TOKEN,
      })
    );
    logger.info('[Email Service] Mailtrap configured successfully');
  } else if (ENV.EMAIL_SERVICE === 'smtp') {
    // Custom SMTP
    logger.info(`[Email Service] SMTP configured: ${ENV.SMTP_HOST}:${ENV.SMTP_PORT}`);
    transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: parseInt(ENV.SMTP_PORT || '587'),
      secure: ENV.SMTP_SECURE === 'true',
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASSWORD,
      },
    });
    logger.info('[Email Service] SMTP transporter created successfully');
  } else if (ENV.EMAIL_SERVICE === 'sendgrid') {
    // SendGrid
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: ENV.SENDGRID_API_KEY,
      },
    });
    logger.info('[Email Service] SendGrid configured');
  } else if (ENV.EMAIL_SERVICE === 'mailgun') {
    // Mailgun
    transporter = nodemailer.createTransport({
      host: `smtp.mailgun.org`,
      port: 587,
      secure: false,
      auth: {
        user: ENV.MAILGUN_API_KEY,
        pass: ENV.MAILGUN_DOMAIN,
      },
    });
    logger.info('[Email Service] Mailgun configured');
  } else {
    // Development/Test mode - log emails to console
    logger.warn('Email service not configured. Emails will be logged to console only.');
  }
}

/**
 * Send an email
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML content
 * @param text - Plain text content (fallback)
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  try {
    if (!transporter) {
      // Log email in development/test mode
      logger.info(`[EMAIL - DEV MODE] To: ${to}, Subject: ${subject}`);
      logger.info(`[EMAIL - DEV MODE] HTML: ${html.substring(0, 200)}...`);
      return true;
    }

    const from = ENV.EMAIL_SERVICE === 'mailtrap'
      ? { address: ENV.EMAIL_FROM, name: 'HKFES Trading' }
      : ENV.EMAIL_FROM || 'noreply@hkfes-trading.com';

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
    });

    logger.info(`Email sent to ${to}: ${subject} (${info.messageId})`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to send email to ${to} (${subject}): ${error.message}`);
    return false;
  }
}

/**
 * Send OTP verification email
 * @param to - Recipient email address
 * @param otp - 6-digit OTP code
 * @param purpose - Purpose of OTP (e.g., 'login', 'verification', 'withdrawal')
 */
export async function sendOtpEmail({
  to,
  otp,
  purpose = 'verification',
}: {
  to: string;
  otp: string;
  purpose?: string;
}): Promise<boolean> {
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

  logger.info(`[EMAIL OTP] To: ${to}, Code: ${otp}, Purpose: ${purpose}`);
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
export async function sendPasswordResetEmail({
  to,
  resetToken,
}: {
  to: string;
  resetToken: string;
}): Promise<boolean> {
  const resetUrl = `${ENV.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

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
