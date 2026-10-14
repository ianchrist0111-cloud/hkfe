# Email OTP Service Setup Guide

This application now supports email-based OTP (One-Time Password) verification for login, email verification, password reset, and withdrawal confirmation.

## Quick Start (Development Mode)

By default, the email service is set to `console` mode, which logs emails to the console instead of sending them. This is perfect for development and testing.

```env
EMAIL_SERVICE=console
```

When in console mode, OTP codes will be logged to the server console with a `[EMAIL - DEV MODE]` prefix.

## Production Email Providers

To send real emails in production, choose one of the following providers:

### Option 1: Gmail (Free, Personal Use)

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification if not already enabled
3. Go to "App Passwords" section
4. Create a new app password (name it "HKFES Trading")
5. Copy the generated password

Update your `.env` file:

```env
EMAIL_SERVICE=gmail
EMAIL_FROM=your-email@gmail.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

**Note:** Gmail has sending limits (500 emails/day for free accounts). For higher volume, consider a paid provider.

### Option 2: SendGrid (Recommended for Production)

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Verify your sender email/domain
3. Get your API Key from Settings > API Keys

Update your `.env` file:

```env
EMAIL_SERVICE=sendgrid
EMAIL_FROM=noreply@yourdomain.com
SENDGRID_API_KEY=SG.your-api-key-here
```

**Free Tier:** 100 emails/day forever

### Option 3: Mailgun

1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Verify your domain
3. Get your API key from the dashboard

Update your `.env` file:

```env
EMAIL_SERVICE=mailgun
EMAIL_FROM=noreply@yourdomain.com
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=your-domain.com
```

**Free Tier:** 5,000 emails/month (first month), then 100/month free

### Option 4: Custom SMTP

If you have your own SMTP server or use another provider:

```env
EMAIL_SERVICE=smtp
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASSWORD=your-password
```

## API Endpoints

### Send OTP
```
POST /auth/otp/send
Body: {
  "email": "user@example.com",
  "purpose": "verification" // optional: 'verification', 'login', 'withdrawal', 'password_reset'
}
```

### Verify OTP
```
POST /auth/otp/verify
Body: {
  "email": "user@example.com",
  "code": "123456",
  "purpose": "verification" // optional
}
```

## Features

- **Rate Limiting:** Max 3 OTP requests per 5 minutes per email
- **Expiration:** OTP codes expire after 10 minutes
- **Security:** Codes are stored in-memory and cleaned up automatically
- **Dev Mode:** Universal test code `123456` works in non-production environments
- **Audit Logging:** All OTP sends and verifications are logged

## Testing

In development mode, the OTP code will be returned in the API response:

```json
{
  "success": true,
  "data": {
    "message": "OTP has been sent to your email address.",
    "devCode": "123456"
  }
}
```

In production, the code is only sent via email and not returned in the response.

## Security Best Practices

1. **Never commit email credentials to version control**
2. **Use environment-specific .env files** (`.env.production`, `.env.staging`)
3. **Rotate API keys regularly**
4. **Monitor email deliverability and bounce rates**
5. **Use domain-based sending (not personal Gmail) for production**
6. **Set up SPF, DKIM, and DMARC records** for your domain

## Troubleshooting

### Emails not sending in production
- Check that `EMAIL_SERVICE` is set correctly
- Verify API credentials are valid
- Check server logs for error messages
- Ensure sender email/domain is verified with the provider

### Rate limiting errors
- Users must wait 5 minutes after 3 failed OTP attempts
- Codes expire after 10 minutes
- Old codes are automatically cleaned up

### Gmail authentication failed
- Ensure you're using an App Password, not your regular password
- 2-Step Verification must be enabled on your Google account
- Check that "Less Secure Apps" is NOT enabled (use App Passwords instead)

## Support

For issues with email delivery, check:
- Provider's status page (SendGrid, Mailgun, etc.)
- Your server logs
- The provider's documentation for troubleshooting
