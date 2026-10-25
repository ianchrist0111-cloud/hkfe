process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app';
import prisma from '../prisma';
import http from 'http';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

describe('HKFES Backend API Automated Test Suite', () => {
  let server: http.Server;
  const testPort = 4099;

  before(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(testPort, resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('GET /api/v1/health should return status ok', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/health`);
    const json: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.status, 'ok');
    assert.equal(json.service, 'hkfes-trading-backend');
  });

  it('GET /api/v1/market/assets should list active tradeable assets with live prices', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/market/assets`);
    const json: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 10);
    const btc = json.data.find((a: any) => a.symbol === 'BTC/USD');
    assert.ok(btc, 'BTC/USD asset should exist');
    assert.ok(btc.currentPrice > 1000);
  });

  it('POST /api/v1/auth/login should reject invalid credentials', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@hkfes.com', password: 'wrongpassword' }),
    });
    const json: any = await res.json();
    assert.equal(res.status, 401);
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/login should authenticate Alex successfully', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const json: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.success, true);
    assert.ok(json.data.token);
    assert.equal(json.data.user.email, 'alex@hkfes.com');
  });

  it('GET /api/v1/wallet should require Authorization header', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/wallet`);
    assert.equal(res.status, 401);
  });

  it('POST /api/v1/admin/stats should reject non-admin users with 403 Forbidden', async () => {
    const alexRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const alexJson: any = await alexRes.json();
    const token = alexJson.data.token;

    const statsRes = await fetch(`http://localhost:${testPort}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(statsRes.status, 403);
  });

  it('GET /api/v1/admin/stats should succeed for Admin Sam', async () => {
    const samRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hkfes.com', password: 'AdminPassword123!' }),
    });
    const samJson: any = await samRes.json();
    const token = samJson.data.token;

    const statsRes = await fetch(`http://localhost:${testPort}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statsJson: any = await statsRes.json();
    assert.equal(statsRes.status, 200);
    assert.equal(statsJson.success, true);
    assert.ok(statsJson.data.totalUsers >= 4);
    assert.equal(statsJson.data.systemHealth, 'optimal');
  });

  it('POST /api/v1/auth/forgot-password and /auth/reset-password should complete recovery cycle', async () => {
    // 1. Request reset
    const forgotRes = await fetch(`http://localhost:${testPort}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com' }),
    });
    const forgotJson: any = await forgotRes.json();
    assert.equal(forgotRes.status, 200);
    assert.equal(forgotJson.success, true);
    assert.ok(forgotJson.data.resetToken, 'Reset token should be returned in test/dev environment');

    // 2. Consume reset token to change password
    const resetRes = await fetch(`http://localhost:${testPort}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: forgotJson.data.resetToken, newPassword: 'NewPassword123!' }),
    });
    const resetJson: any = await resetRes.json();
    assert.equal(resetRes.status, 200);
    assert.equal(resetJson.success, true);

    // 3. Authenticate with new password
    const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'NewPassword123!' }),
    });
    const loginJson: any = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.equal(loginJson.success, true);
    assert.ok(loginJson.data.token);

    // 4. Restore original password for idempotency
    const restoreForgot = await fetch(`http://localhost:${testPort}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com' }),
    });
    const restoreForgotJson: any = await restoreForgot.json();
    await fetch(`http://localhost:${testPort}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: restoreForgotJson.data.resetToken, newPassword: 'Password123!' }),
    });
  });

  it('POST /api/v1/auth/refresh should rotate active token', async () => {
    // 1. Login
    const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const loginJson: any = await loginRes.json();
    const originalToken = loginJson.data.token;

    // 2. Refresh
    const refreshRes = await fetch(`http://localhost:${testPort}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${originalToken}` },
    });
    const refreshJson: any = await refreshRes.json();
    assert.equal(refreshRes.status, 200);
    assert.equal(refreshJson.success, true);
    assert.ok(refreshJson.data.token);
    assert.notEqual(refreshJson.data.token, originalToken, 'New token should differ from original');

    // 3. Previous token should now be blacklisted
    const staleRes = await fetch(`http://localhost:${testPort}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${originalToken}` },
    });
    assert.equal(staleRes.status, 401);
  });

  it('POST /api/v1/wallet/transfer should move funds between sub-wallets and validate limits', async () => {
    // 1. Authenticate Alex
    const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const loginJson: any = await loginRes.json();
    assert.equal(loginRes.status, 200);
    const token = loginJson.data?.token;

    // 2. Transfer $250 from available to trading
    const transferRes = await fetch(`http://localhost:${testPort}/api/v1/wallet/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ from: 'available', to: 'trading', amount: 250 }),
    });
    const transferJson: any = await transferRes.json();
    assert.equal(transferRes.status, 200);




    assert.equal(transferJson.success, true);
    assert.ok(transferJson.data.wallet);
    assert.ok(transferJson.data.transaction);
    assert.equal(transferJson.data.transaction.type, 'internal_transfer');

    // 3. Reject transfer exceeding balance
    const overspendRes = await fetch(`http://localhost:${testPort}/api/v1/wallet/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ from: 'trading', to: 'available', amount: 9999999 }),
    });
    assert.equal(overspendRes.status, 400);

    // 4. Transfer back $250 from trading to available
    const revertRes = await fetch(`http://localhost:${testPort}/api/v1/wallet/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ from: 'trading', to: 'available', amount: 250 }),
    });
    const revertJson: any = await revertRes.json();
    assert.equal(revertRes.status, 200);
    assert.equal(revertJson.success, true);
  });

  it('API responses should include X-Response-Time latency profiling header', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/v1/health`);
    assert.ok(res.headers.has('x-response-time'), 'Response must have X-Response-Time header');
    const headerVal = res.headers.get('x-response-time');
    assert.ok(headerVal?.endsWith('ms'), 'X-Response-Time must be in ms');
  });

  it('POST /api/v1/auth/send-verification and /verify-email should complete email verification cycle', async () => {
    // 1. Register a fresh user with unverified email
    const testEmail = `verify-${Date.now()}@hkfes.com`;
    const regRes = await fetch(`http://localhost:${testPort}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Verification',
      }),
    });
    const regJson: any = await regRes.json();
    const token = regJson.data.token;

    // 2. Request verification code
    const sendRes = await fetch(`http://localhost:${testPort}/api/v1/auth/send-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const sendJson: any = await sendRes.json();
    assert.equal(sendRes.status, 200);
    assert.equal(sendJson.success, true);
    assert.ok(sendJson.data.devCode, 'Dev code should be returned in test environment');

    // 3. Reject invalid verification code
    const badVerifyRes = await fetch(`http://localhost:${testPort}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: '000000' }),
    });
    assert.equal(badVerifyRes.status, 400);

    // 4. Verify with actual devCode
    const verifyRes = await fetch(`http://localhost:${testPort}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: sendJson.data.devCode }),
    });
    const verifyJson: any = await verifyRes.json();
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyJson.success, true);
    assert.equal(verifyJson.data.emailVerified, true);
    assert.ok(verifyJson.data.emailVerifiedAt);
  });

  it('Support & Role isolation: user can create tickets but cannot access admin helpdesk or user manager', async () => {
    // 1. Authenticate regular user Alex
    const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const alexAuth: any = await alexLogin.json();
    const alexToken = alexAuth.data.token;

    // 2. Authenticate Admin Sam
    const adminLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hkfes.com', password: 'AdminPassword123!' }),
    });
    const adminAuth: any = await adminLogin.json();
    const adminToken = adminAuth.data.token;

    // 3. User Alex attempts to access admin support desk -> 403 Forbidden
    const forbiddenRes = await fetch(`http://localhost:${testPort}/api/v1/support/admin/tickets`, {
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    assert.equal(forbiddenRes.status, 403, 'Regular user must be forbidden from accessing admin support desk');

    // Clean up any existing tickets for Alex from previous test runs to prevent 429
    await prisma.supportTicket.deleteMany({ where: { userId: alexAuth.data.user.id } });

    // 4. User Alex creates a support ticket
    const ticketRes = await fetch(`http://localhost:${testPort}/api/v1/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        category: 'kyc',
        subject: 'Inquiry regarding document verification',
        message: 'Hello, please confirm receipt of my passport and update my review status.',
        priority: 'high',
        contactChannel: 'telegram',
        contactHandle: '@alex_trader',
      }),
    });
    const ticketJson: any = await ticketRes.json();
    assert.equal(ticketRes.status, 201);
    assert.equal(ticketJson.success, true);
    assert.ok(ticketJson.data.ticketNumber.startsWith('HK-'));
    const ticketId = ticketJson.data.id;

    // 5. Admin Sam can access admin support desk and view the ticket
    const adminTicketsRes = await fetch(`http://localhost:${testPort}/api/v1/support/admin/tickets?search=${ticketJson.data.ticketNumber}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminTicketsJson: any = await adminTicketsRes.json();
    assert.equal(adminTicketsRes.status, 200);
    assert.ok(adminTicketsJson.data.length >= 1);

    // 6. Admin Sam replies to Alex's ticket
    const replyRes = await fetch(`http://localhost:${testPort}/api/v1/support/admin/tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        body: 'Your KYC documents are currently in queue. We expect review within 1 hour.',
        isInternal: false,
      }),
    });
    const replyJson: any = await replyRes.json();
    assert.equal(replyRes.status, 201);
    assert.equal(replyJson.success, true);

    // 7. Alex fetches own ticket messages and sees admin reply
    const alexTicketRes = await fetch(`http://localhost:${testPort}/api/v1/support/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    const alexTicketJson: any = await alexTicketRes.json();
    assert.equal(alexTicketRes.status, 200);
    assert.ok(alexTicketJson.data.messages.length >= 2);
  });

  it('KYC flow: user submits personal details and checks status with inquiry capability', async () => {
    // Authenticate Alex
    const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const alexAuth: any = await alexLogin.json();
    const token = alexAuth.data.token;

    // Check status
    const statusRes = await fetch(`http://localhost:${testPort}/api/v1/kyc/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusJson: any = await statusRes.json();
    assert.equal(statusRes.status, 200);
    assert.equal(statusJson.success, true);
    assert.ok(statusJson.data.kycStatus);
  });

  it('Admin restriction controls: allow/disallow trading and withdrawals enforcement', async () => {
    // 1. Login Admin Sam
    const samLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hkfes.com', password: 'AdminPassword123!' }),
    });
    const samAuth: any = await samLogin.json();
    const adminToken = samAuth.data.token;

    // 2. Login Alex
    const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const alexAuth: any = await alexLogin.json();
    const alexToken = alexAuth.data.token;
    const alexId = alexAuth.data.user.id;

    // 3. Admin disallows trading for Alex
    const blockRes = await fetch(`http://localhost:${testPort}/api/v1/admin/users/${alexId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ tradingBlocked: true, withdrawalsBlocked: true }),
    });
    const blockJson: any = await blockRes.json();
    assert.equal(blockRes.status, 200);
    assert.equal(blockJson.data.tradingBlocked, true);
    assert.equal(blockJson.data.withdrawalsBlocked, true);

    // 4. Alex attempts to place trade order -> should be rejected with 403 TRADING_DISALLOWED
    const orderRes = await fetch(`http://localhost:${testPort}/api/v1/trading/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        symbol: 'BTC/USD',
        direction: 'buy',
        orderType: 'market',
        sizeUsd: 100,
      }),
    });
    const orderJson: any = await orderRes.json();
    assert.equal(orderRes.status, 403);
    assert.equal(orderJson.success, false);
    assert.equal(orderJson.error.code, 'TRADING_DISALLOWED');

    // 5. Alex attempts withdrawal -> should be rejected with 403 WITHDRAWALS_DISALLOWED
    const withdrawRes = await fetch(`http://localhost:${testPort}/api/v1/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      },
      body: JSON.stringify({
        amount: 50,
        destination: '0x1234567890123456789012345678901234567890',
        method: 'crypto',
      }),
    });
    const withdrawJson: any = await withdrawRes.json();
    assert.equal(withdrawRes.status, 403);
    assert.equal(withdrawJson.success, false);
    assert.equal(withdrawJson.error.code, 'WITHDRAWALS_DISALLOWED');

    // 6. Admin restores trading for Alex
    const unblockRes = await fetch(`http://localhost:${testPort}/api/v1/admin/users/${alexId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ tradingBlocked: false, withdrawalsBlocked: false }),
    });
    const unblockJson: any = await unblockRes.json();
    assert.equal(unblockRes.status, 200);
    assert.equal(unblockJson.data.tradingBlocked, false);
    assert.equal(unblockJson.data.withdrawalsBlocked, false);
  });

  it('Short-Term Options (30s, 60s, 90s, 120s): contract placement, active tracking, and settlement with 90% payout', async () => {
    // 1. Authenticate user Alex
    const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const authData: any = await loginRes.json();
    const token = authData.data.token;

    // 2. Place 30s Turbo Option (CALL)
    const placeRes = await fetch(`http://localhost:${testPort}/api/v1/trading/options/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        symbol: 'BTC/USD',
        direction: 'call',
        durationSeconds: 30,
        amount: 100,
        payoutRate: 0.90,
      }),
    });
    const placeJson: any = await placeRes.json();
    assert.equal(placeRes.status, 201);
    assert.equal(placeJson.success, true);
    assert.equal(placeJson.data.contract.orderType, 'short_term_option');
    assert.equal(placeJson.data.contract.durationSeconds, 30);
    assert.equal(placeJson.data.contract.sizeUsd, 100);
    assert.ok(placeJson.data.contract.strikePrice > 0);
    assert.ok(placeJson.data.contract.targetExpiry);

    const contractId = placeJson.data.contract.id;
    const strike = placeJson.data.contract.strikePrice;

    // 3. Query active contracts
    const activeRes = await fetch(`http://localhost:${testPort}/api/v1/trading/options/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activeJson: any = await activeRes.json();
    assert.equal(activeRes.status, 200);
    assert.equal(activeJson.success, true);
    assert.ok(activeJson.data.total >= 1);
    const activeContract = activeJson.data.contracts.find((c: any) => c.id === contractId);
    assert.ok(activeContract);
    assert.equal(activeContract.durationSeconds, 30);
    assert.ok(activeContract.remainingSeconds <= 30);

    // 4. Settle contract as In-The-Money Win (+90% profit)
    const settleRes = await fetch(`http://localhost:${testPort}/api/v1/trading/options/${contractId}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contractId,
        exitPrice: strike + 100, // higher than strike -> CALL won
      }),
    });
    const settleJson: any = await settleRes.json();
    assert.equal(settleRes.status, 200);
    assert.equal(settleJson.success, true);
    assert.equal(settleJson.data.outcome, 'won');
    assert.equal(settleJson.data.realizedPnl, 90);
    assert.equal(settleJson.data.totalReturn, 190);
    assert.equal(settleJson.data.contract.status, 'won');
  });

  // 17. Super Admin: Streamlined Payment Methods & Telegram Support Configuration
  it('Super Admin: Streamlined Payment Methods & Telegram Support Configuration', async () => {
    // 1. Public platform config initially returns Telegram disabled and payments disabled
    const pubConfigRes = await fetch(`http://localhost:${testPort}/api/v1/platform/config`);
    const pubConfigJson: any = await pubConfigRes.json();
    assert.equal(pubConfigRes.status, 200);
    assert.equal(pubConfigJson.success, true);
    assert.equal(typeof pubConfigJson.data.telegramEnabled, 'boolean');
    assert.equal(typeof pubConfigJson.data.paymentsEnabled, 'boolean');

    // 2. Regular user / Non-super-admin is blocked from Super Admin settings
    const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
    });
    const alexToken = (await alexLogin.json() as any).data.token;

    const blockedRes = await fetch(`http://localhost:${testPort}/api/v1/platform/admin/settings`, {
      headers: { Authorization: `Bearer ${alexToken}` },
    });
    assert.equal(blockedRes.status, 403, 'Regular trader must be forbidden from Super Admin settings');

    // 3. Super Admin logs in
    const superLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@hkfes.com', password: 'SuperAdmin123!' }),
    });
    const superToken = (await superLogin.json() as any).data.token;
    assert.ok(superToken, 'Super Admin authentication must succeed');

    // 4. Super Admin enables payments and configures Telegram
    const updateRes = await fetch(`http://localhost:${testPort}/api/v1/platform/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        paymentsEnabled: true,
        telegramEnabled: true,
        telegramHandle: '@hkfes_desk',
        telegramNumber: '+1234567890',
      }),
    });
    const updateJson: any = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateJson.success, true);
    assert.equal(updateJson.data.paymentsEnabled, true);
    assert.equal(updateJson.data.telegramEnabled, true);
    assert.equal(updateJson.data.telegramUrl, 'https://t.me/hkfes_desk');

    // 5. Verify public config now reflects Telegram live support
    const pubConfigUpdated = await (await fetch(`http://localhost:${testPort}/api/v1/platform/config`)).json() as any;
    assert.equal(pubConfigUpdated.data.telegramEnabled, true);
    assert.equal(pubConfigUpdated.data.telegramHandle, '@hkfes_desk');
    assert.equal(pubConfigUpdated.data.telegramUrl, 'https://t.me/hkfes_desk');

    // 6. Super Admin adds and publishes a new deposit method
    const createWalletRes = await fetch(`http://localhost:${testPort}/api/v1/platform/admin/deposit-wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        asset: 'USDT',
        network: 'USDT_TRC20',
        address: 'TTestWalletStreamline123456789Address',
        minDeposit: 25.0,
        details: 'Deposit only USDT via Tron network. 1 confirmation required.',
        isActive: true,
      }),
    });
    const createWalletJson: any = await createWalletRes.json();
    assert.equal(createWalletRes.status, 201);
    assert.equal(createWalletJson.success, true);
    const createdWalletId = createWalletJson.data.id;

    // 7. Verify trader deposit-wallets endpoint returns the published method with no dummy details
    const walletsRes = await (await fetch(`http://localhost:${testPort}/api/v1/crypto/deposit-wallets`)).json() as any;
    assert.equal(walletsRes.success, true);
    assert.equal(walletsRes.paymentsEnabled, true);
    const found = walletsRes.data.find((w: any) => w.id === createdWalletId);
    assert.ok(found, 'Trader endpoint must contain the Super Admin published deposit method');
    assert.equal(found.address, 'TTestWalletStreamline123456789Address');
    assert.equal(found.details, 'Deposit only USDT via Tron network. 1 confirmation required.');

    // 8. Super Admin deletes the test wallet and resets telegram for clean state
    await fetch(`http://localhost:${testPort}/api/v1/platform/admin/deposit-wallets/${createdWalletId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superToken}` },
    });
    await fetch(`http://localhost:${testPort}/api/v1/platform/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        paymentsEnabled: false,
        telegramEnabled: false,
      }),
    });
  });
});


