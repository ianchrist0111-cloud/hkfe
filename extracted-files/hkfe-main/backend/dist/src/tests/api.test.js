"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_ENV = 'test';
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const app_1 = require("../app");
const prisma_1 = __importDefault(require("../prisma"));
const http_1 = __importDefault(require("http"));
(0, node_test_1.describe)('HKFES Backend API Automated Test Suite', () => {
    let server;
    const testPort = 4099;
    (0, node_test_1.before)(async () => {
        const app = (0, app_1.createApp)();
        server = http_1.default.createServer(app);
        await new Promise((resolve) => server.listen(testPort, resolve));
    });
    (0, node_test_1.after)(async () => {
        await new Promise((resolve) => server.close(() => resolve()));
        await prisma_1.default.$disconnect();
    });
    (0, node_test_1.it)('GET /api/v1/health should return status ok', async () => {
        const res = await fetch(`http://localhost:${testPort}/api/v1/health`);
        const json = await res.json();
        strict_1.default.equal(res.status, 200);
        strict_1.default.equal(json.status, 'ok');
        strict_1.default.equal(json.service, 'hkfes-trading-backend');
    });
    (0, node_test_1.it)('GET /api/v1/market/assets should list active tradeable assets with live prices', async () => {
        const res = await fetch(`http://localhost:${testPort}/api/v1/market/assets`);
        const json = await res.json();
        strict_1.default.equal(res.status, 200);
        strict_1.default.equal(json.success, true);
        strict_1.default.ok(Array.isArray(json.data));
        strict_1.default.ok(json.data.length >= 10);
        const btc = json.data.find((a) => a.symbol === 'BTC/USD');
        strict_1.default.ok(btc, 'BTC/USD asset should exist');
        strict_1.default.ok(btc.currentPrice > 1000);
    });
    (0, node_test_1.it)('POST /api/v1/auth/login should reject invalid credentials', async () => {
        const res = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent@hkfes.com', password: 'wrongpassword' }),
        });
        const json = await res.json();
        strict_1.default.equal(res.status, 401);
        strict_1.default.equal(json.success, false);
        strict_1.default.equal(json.error.code, 'INVALID_CREDENTIALS');
    });
    (0, node_test_1.it)('POST /api/v1/auth/login should authenticate Alex successfully', async () => {
        const res = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const json = await res.json();
        strict_1.default.equal(res.status, 200);
        strict_1.default.equal(json.success, true);
        strict_1.default.ok(json.data.token);
        strict_1.default.equal(json.data.user.email, 'alex@hkfes.com');
    });
    (0, node_test_1.it)('GET /api/v1/wallet should require Authorization header', async () => {
        const res = await fetch(`http://localhost:${testPort}/api/v1/wallet`);
        strict_1.default.equal(res.status, 401);
    });
    (0, node_test_1.it)('POST /api/v1/admin/stats should reject non-admin users with 403 Forbidden', async () => {
        const alexRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const alexJson = await alexRes.json();
        const token = alexJson.data.token;
        const statsRes = await fetch(`http://localhost:${testPort}/api/v1/admin/stats`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        strict_1.default.equal(statsRes.status, 403);
    });
    (0, node_test_1.it)('GET /api/v1/admin/stats should succeed for Admin Sam', async () => {
        const samRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@hkfes.com', password: 'AdminPassword123!' }),
        });
        const samJson = await samRes.json();
        const token = samJson.data.token;
        const statsRes = await fetch(`http://localhost:${testPort}/api/v1/admin/stats`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const statsJson = await statsRes.json();
        strict_1.default.equal(statsRes.status, 200);
        strict_1.default.equal(statsJson.success, true);
        strict_1.default.ok(statsJson.data.totalUsers >= 4);
        strict_1.default.equal(statsJson.data.systemHealth, 'optimal');
    });
    (0, node_test_1.it)('POST /api/v1/auth/forgot-password and /auth/reset-password should complete recovery cycle', async () => {
        // 1. Request reset
        const forgotRes = await fetch(`http://localhost:${testPort}/api/v1/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com' }),
        });
        const forgotJson = await forgotRes.json();
        strict_1.default.equal(forgotRes.status, 200);
        strict_1.default.equal(forgotJson.success, true);
        strict_1.default.ok(forgotJson.data.resetToken, 'Reset token should be returned in test/dev environment');
        // 2. Consume reset token to change password
        const resetRes = await fetch(`http://localhost:${testPort}/api/v1/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: forgotJson.data.resetToken, newPassword: 'NewPassword123!' }),
        });
        const resetJson = await resetRes.json();
        strict_1.default.equal(resetRes.status, 200);
        strict_1.default.equal(resetJson.success, true);
        // 3. Authenticate with new password
        const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'NewPassword123!' }),
        });
        const loginJson = await loginRes.json();
        strict_1.default.equal(loginRes.status, 200);
        strict_1.default.equal(loginJson.success, true);
        strict_1.default.ok(loginJson.data.token);
        // 4. Restore original password for idempotency
        const restoreForgot = await fetch(`http://localhost:${testPort}/api/v1/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com' }),
        });
        const restoreForgotJson = await restoreForgot.json();
        await fetch(`http://localhost:${testPort}/api/v1/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: restoreForgotJson.data.resetToken, newPassword: 'Password123!' }),
        });
    });
    (0, node_test_1.it)('POST /api/v1/auth/refresh should rotate active token', async () => {
        // 1. Login
        const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const loginJson = await loginRes.json();
        const originalToken = loginJson.data.token;
        // 2. Refresh
        const refreshRes = await fetch(`http://localhost:${testPort}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${originalToken}` },
        });
        const refreshJson = await refreshRes.json();
        strict_1.default.equal(refreshRes.status, 200);
        strict_1.default.equal(refreshJson.success, true);
        strict_1.default.ok(refreshJson.data.token);
        strict_1.default.notEqual(refreshJson.data.token, originalToken, 'New token should differ from original');
        // 3. Previous token should now be blacklisted
        const staleRes = await fetch(`http://localhost:${testPort}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${originalToken}` },
        });
        strict_1.default.equal(staleRes.status, 401);
    });
    (0, node_test_1.it)('POST /api/v1/wallet/transfer should move funds between sub-wallets and validate limits', async () => {
        // 1. Authenticate Alex
        const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const loginJson = await loginRes.json();
        strict_1.default.equal(loginRes.status, 200);
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
        const transferJson = await transferRes.json();
        strict_1.default.equal(transferRes.status, 200);
        strict_1.default.equal(transferJson.success, true);
        strict_1.default.ok(transferJson.data.wallet);
        strict_1.default.ok(transferJson.data.transaction);
        strict_1.default.equal(transferJson.data.transaction.type, 'internal_transfer');
        // 3. Reject transfer exceeding balance
        const overspendRes = await fetch(`http://localhost:${testPort}/api/v1/wallet/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ from: 'trading', to: 'available', amount: 9999999 }),
        });
        strict_1.default.equal(overspendRes.status, 400);
        // 4. Transfer back $250 from trading to available
        const revertRes = await fetch(`http://localhost:${testPort}/api/v1/wallet/transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ from: 'trading', to: 'available', amount: 250 }),
        });
        const revertJson = await revertRes.json();
        strict_1.default.equal(revertRes.status, 200);
        strict_1.default.equal(revertJson.success, true);
    });
    (0, node_test_1.it)('API responses should include X-Response-Time latency profiling header', async () => {
        const res = await fetch(`http://localhost:${testPort}/api/v1/health`);
        strict_1.default.ok(res.headers.has('x-response-time'), 'Response must have X-Response-Time header');
        const headerVal = res.headers.get('x-response-time');
        strict_1.default.ok(headerVal?.endsWith('ms'), 'X-Response-Time must be in ms');
    });
    (0, node_test_1.it)('POST /api/v1/auth/send-verification and /verify-email should complete email verification cycle', async () => {
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
        const regJson = await regRes.json();
        const token = regJson.data.token;
        // 2. Request verification code
        const sendRes = await fetch(`http://localhost:${testPort}/api/v1/auth/send-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
        const sendJson = await sendRes.json();
        strict_1.default.equal(sendRes.status, 200);
        strict_1.default.equal(sendJson.success, true);
        strict_1.default.ok(sendJson.data.devCode, 'Dev code should be returned in test environment');
        // 3. Reject invalid verification code
        const badVerifyRes = await fetch(`http://localhost:${testPort}/api/v1/auth/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ code: '000000' }),
        });
        strict_1.default.equal(badVerifyRes.status, 400);
        // 4. Verify with actual devCode
        const verifyRes = await fetch(`http://localhost:${testPort}/api/v1/auth/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ code: sendJson.data.devCode }),
        });
        const verifyJson = await verifyRes.json();
        strict_1.default.equal(verifyRes.status, 200);
        strict_1.default.equal(verifyJson.success, true);
        strict_1.default.equal(verifyJson.data.emailVerified, true);
        strict_1.default.ok(verifyJson.data.emailVerifiedAt);
    });
    (0, node_test_1.it)('Support & Role isolation: user can create tickets but cannot access admin helpdesk or user manager', async () => {
        // 1. Authenticate regular user Alex
        const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const alexAuth = await alexLogin.json();
        const alexToken = alexAuth.data.token;
        // 2. Authenticate Admin Sam
        const adminLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@hkfes.com', password: 'AdminPassword123!' }),
        });
        const adminAuth = await adminLogin.json();
        const adminToken = adminAuth.data.token;
        // 3. User Alex attempts to access admin support desk -> 403 Forbidden
        const forbiddenRes = await fetch(`http://localhost:${testPort}/api/v1/support/admin/tickets`, {
            headers: { Authorization: `Bearer ${alexToken}` },
        });
        strict_1.default.equal(forbiddenRes.status, 403, 'Regular user must be forbidden from accessing admin support desk');
        // Clean up any existing tickets for Alex from previous test runs to prevent 429
        await prisma_1.default.supportTicket.deleteMany({ where: { userId: alexAuth.data.user.id } });
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
        const ticketJson = await ticketRes.json();
        strict_1.default.equal(ticketRes.status, 201);
        strict_1.default.equal(ticketJson.success, true);
        strict_1.default.ok(ticketJson.data.ticketNumber.startsWith('HK-'));
        const ticketId = ticketJson.data.id;
        // 5. Admin Sam can access admin support desk and view the ticket
        const adminTicketsRes = await fetch(`http://localhost:${testPort}/api/v1/support/admin/tickets?search=${ticketJson.data.ticketNumber}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const adminTicketsJson = await adminTicketsRes.json();
        strict_1.default.equal(adminTicketsRes.status, 200);
        strict_1.default.ok(adminTicketsJson.data.length >= 1);
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
        const replyJson = await replyRes.json();
        strict_1.default.equal(replyRes.status, 201);
        strict_1.default.equal(replyJson.success, true);
        // 7. Alex fetches own ticket messages and sees admin reply
        const alexTicketRes = await fetch(`http://localhost:${testPort}/api/v1/support/tickets/${ticketId}`, {
            headers: { Authorization: `Bearer ${alexToken}` },
        });
        const alexTicketJson = await alexTicketRes.json();
        strict_1.default.equal(alexTicketRes.status, 200);
        strict_1.default.ok(alexTicketJson.data.messages.length >= 2);
    });
    (0, node_test_1.it)('KYC flow: user submits personal details and checks status with inquiry capability', async () => {
        // Authenticate Alex
        const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const alexAuth = await alexLogin.json();
        const token = alexAuth.data.token;
        // Check status
        const statusRes = await fetch(`http://localhost:${testPort}/api/v1/kyc/status`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const statusJson = await statusRes.json();
        strict_1.default.equal(statusRes.status, 200);
        strict_1.default.equal(statusJson.success, true);
        strict_1.default.ok(statusJson.data.kycStatus);
    });
    (0, node_test_1.it)('Admin restriction controls: allow/disallow trading and withdrawals enforcement', async () => {
        // 1. Login Admin Sam
        const samLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@hkfes.com', password: 'AdminPassword123!' }),
        });
        const samAuth = await samLogin.json();
        const adminToken = samAuth.data.token;
        // 2. Login Alex
        const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const alexAuth = await alexLogin.json();
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
        const blockJson = await blockRes.json();
        strict_1.default.equal(blockRes.status, 200);
        strict_1.default.equal(blockJson.data.tradingBlocked, true);
        strict_1.default.equal(blockJson.data.withdrawalsBlocked, true);
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
        const orderJson = await orderRes.json();
        strict_1.default.equal(orderRes.status, 403);
        strict_1.default.equal(orderJson.success, false);
        strict_1.default.equal(orderJson.error.code, 'TRADING_DISALLOWED');
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
        const withdrawJson = await withdrawRes.json();
        strict_1.default.equal(withdrawRes.status, 403);
        strict_1.default.equal(withdrawJson.success, false);
        strict_1.default.equal(withdrawJson.error.code, 'WITHDRAWALS_DISALLOWED');
        // 6. Admin restores trading for Alex
        const unblockRes = await fetch(`http://localhost:${testPort}/api/v1/admin/users/${alexId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ tradingBlocked: false, withdrawalsBlocked: false }),
        });
        const unblockJson = await unblockRes.json();
        strict_1.default.equal(unblockRes.status, 200);
        strict_1.default.equal(unblockJson.data.tradingBlocked, false);
        strict_1.default.equal(unblockJson.data.withdrawalsBlocked, false);
    });
    (0, node_test_1.it)('Short-Term Options (30s, 60s, 90s, 120s): contract placement, active tracking, and settlement with 90% payout', async () => {
        // 1. Authenticate user Alex
        const loginRes = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const authData = await loginRes.json();
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
        const placeJson = await placeRes.json();
        strict_1.default.equal(placeRes.status, 201);
        strict_1.default.equal(placeJson.success, true);
        strict_1.default.equal(placeJson.data.contract.orderType, 'short_term_option');
        strict_1.default.equal(placeJson.data.contract.durationSeconds, 30);
        strict_1.default.equal(placeJson.data.contract.sizeUsd, 100);
        strict_1.default.ok(placeJson.data.contract.strikePrice > 0);
        strict_1.default.ok(placeJson.data.contract.targetExpiry);
        const contractId = placeJson.data.contract.id;
        const strike = placeJson.data.contract.strikePrice;
        // 3. Query active contracts
        const activeRes = await fetch(`http://localhost:${testPort}/api/v1/trading/options/active`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const activeJson = await activeRes.json();
        strict_1.default.equal(activeRes.status, 200);
        strict_1.default.equal(activeJson.success, true);
        strict_1.default.ok(activeJson.data.total >= 1);
        const activeContract = activeJson.data.contracts.find((c) => c.id === contractId);
        strict_1.default.ok(activeContract);
        strict_1.default.equal(activeContract.durationSeconds, 30);
        strict_1.default.ok(activeContract.remainingSeconds <= 30);
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
        const settleJson = await settleRes.json();
        strict_1.default.equal(settleRes.status, 200);
        strict_1.default.equal(settleJson.success, true);
        strict_1.default.equal(settleJson.data.outcome, 'won');
        strict_1.default.equal(settleJson.data.realizedPnl, 90);
        strict_1.default.equal(settleJson.data.totalReturn, 190);
        strict_1.default.equal(settleJson.data.contract.status, 'won');
    });
    // 17. Super Admin: Streamlined Payment Methods & Telegram Support Configuration
    (0, node_test_1.it)('Super Admin: Streamlined Payment Methods & Telegram Support Configuration', async () => {
        // 1. Public platform config initially returns Telegram disabled and payments disabled
        const pubConfigRes = await fetch(`http://localhost:${testPort}/api/v1/platform/config`);
        const pubConfigJson = await pubConfigRes.json();
        strict_1.default.equal(pubConfigRes.status, 200);
        strict_1.default.equal(pubConfigJson.success, true);
        strict_1.default.equal(typeof pubConfigJson.data.telegramEnabled, 'boolean');
        strict_1.default.equal(typeof pubConfigJson.data.paymentsEnabled, 'boolean');
        // 2. Regular user / Non-super-admin is blocked from Super Admin settings
        const alexLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'alex@hkfes.com', password: 'Password123!' }),
        });
        const alexToken = (await alexLogin.json()).data.token;
        const blockedRes = await fetch(`http://localhost:${testPort}/api/v1/platform/admin/settings`, {
            headers: { Authorization: `Bearer ${alexToken}` },
        });
        strict_1.default.equal(blockedRes.status, 403, 'Regular trader must be forbidden from Super Admin settings');
        // 3. Super Admin logs in
        const superLogin = await fetch(`http://localhost:${testPort}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'superadmin@hkfes.com', password: 'SuperAdmin123!' }),
        });
        const superToken = (await superLogin.json()).data.token;
        strict_1.default.ok(superToken, 'Super Admin authentication must succeed');
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
        const updateJson = await updateRes.json();
        strict_1.default.equal(updateRes.status, 200);
        strict_1.default.equal(updateJson.success, true);
        strict_1.default.equal(updateJson.data.paymentsEnabled, true);
        strict_1.default.equal(updateJson.data.telegramEnabled, true);
        strict_1.default.equal(updateJson.data.telegramUrl, 'https://t.me/hkfes_desk');
        // 5. Verify public config now reflects Telegram live support
        const pubConfigUpdated = await (await fetch(`http://localhost:${testPort}/api/v1/platform/config`)).json();
        strict_1.default.equal(pubConfigUpdated.data.telegramEnabled, true);
        strict_1.default.equal(pubConfigUpdated.data.telegramHandle, '@hkfes_desk');
        strict_1.default.equal(pubConfigUpdated.data.telegramUrl, 'https://t.me/hkfes_desk');
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
        const createWalletJson = await createWalletRes.json();
        strict_1.default.equal(createWalletRes.status, 201);
        strict_1.default.equal(createWalletJson.success, true);
        const createdWalletId = createWalletJson.data.id;
        // 7. Verify trader deposit-wallets endpoint returns the published method with no dummy details
        const walletsRes = await (await fetch(`http://localhost:${testPort}/api/v1/crypto/deposit-wallets`)).json();
        strict_1.default.equal(walletsRes.success, true);
        strict_1.default.equal(walletsRes.paymentsEnabled, true);
        const found = walletsRes.data.find((w) => w.id === createdWalletId);
        strict_1.default.ok(found, 'Trader endpoint must contain the Super Admin published deposit method');
        strict_1.default.equal(found.address, 'TTestWalletStreamline123456789Address');
        strict_1.default.equal(found.details, 'Deposit only USDT via Tron network. 1 confirmation required.');
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
