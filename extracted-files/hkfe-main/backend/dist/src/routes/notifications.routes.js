"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushUserNotification = void 0;
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// In-memory simulated notifications store
const simulatedNotifications = {};
const getOrInitNotifications = (userId) => {
    if (!simulatedNotifications[userId]) {
        simulatedNotifications[userId] = [
            {
                id: 'notif-1',
                title: 'Welcome to HKFES',
                message: 'Your simulated paper trading account has been credited with $10,000 USD.',
                type: 'system',
                read: false,
                createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
                id: 'notif-2',
                title: 'KYC Document Verified',
                message: 'Your identity document has been approved in simulated mode.',
                type: 'kyc',
                read: true,
                createdAt: new Date(Date.now() - 7200000).toISOString(),
            },
            {
                id: 'notif-3',
                title: 'Price Alert: BTC/USD',
                message: 'Bitcoin has crossed the $65,000 threshold.',
                type: 'price',
                read: false,
                createdAt: new Date(Date.now() - 10800000).toISOString(),
            },
        ];
    }
    return simulatedNotifications[userId];
};
/** Push an in-app notification to a specific user (used by KYC review & support desk). */
const pushUserNotification = (userId, notif) => {
    const list = getOrInitNotifications(userId);
    const entry = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: notif.title,
        message: notif.message,
        type: notif.type || 'system',
        read: false,
        createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    return entry;
};
exports.pushUserNotification = pushUserNotification;
// GET /notifications
router.get('/', auth_1.authenticateJwt, (req, res) => {
    const list = getOrInitNotifications(req.user.id);
    res.json({
        success: true,
        data: {
            notifications: list,
            unreadCount: list.filter((n) => !n.read).length,
        },
    });
});
// PATCH /notifications/:id/read
router.patch('/:id/read', auth_1.authenticateJwt, (req, res) => {
    const list = getOrInitNotifications(req.user.id);
    const target = list.find((n) => n.id === req.params.id);
    if (target) {
        target.read = true;
    }
    res.json({ success: true, data: target || null });
});
// PATCH /notifications/read-all
router.patch('/read-all', auth_1.authenticateJwt, (req, res) => {
    const list = getOrInitNotifications(req.user.id);
    list.forEach((n) => (n.read = true));
    res.json({ success: true, data: { message: 'All notifications marked as read.' } });
});
// DELETE /notifications/:id
router.delete('/:id', auth_1.authenticateJwt, (req, res) => {
    const list = getOrInitNotifications(req.user.id);
    simulatedNotifications[req.user.id] = list.filter((n) => n.id !== req.params.id);
    res.json({ success: true, data: { message: 'Notification removed.' } });
});
// Push subscriptions registry
const userPushSubscriptions = {};
// POST /notifications/subscribe
router.post('/subscribe', (req, res) => {
    const userId = req.user?.id || 'guest_user';
    const { subscription } = req.body;
    if (!userPushSubscriptions[userId]) {
        userPushSubscriptions[userId] = [];
    }
    if (subscription) {
        userPushSubscriptions[userId].push(subscription);
    }
    res.json({ success: true, message: 'Web Push subscription registered.' });
});
// POST /notifications/test-push
router.post('/test-push', auth_1.authenticateJwt, (req, res) => {
    const userId = req.user.id;
    const list = getOrInitNotifications(userId);
    const newNotif = {
        id: `notif-${Date.now()}`,
        title: req.body.title || 'Deposit Confirmed: 5,000 USDT ⚡',
        message: req.body.message || 'Block confirmations received. Balance ready for trading.',
        type: req.body.type || 'system',
        read: false,
        createdAt: new Date().toISOString(),
    };
    list.unshift(newNotif);
    res.json({ success: true, data: newNotif });
});
exports.default = router;
