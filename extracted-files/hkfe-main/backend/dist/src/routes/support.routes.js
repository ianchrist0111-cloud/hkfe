"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const schemas_1 = require("../schemas");
const notifications_routes_1 = require("./notifications.routes");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJwt);
const ADMIN_ROLES = ['admin', 'super_admin'];
const generateTicketNumber = async () => {
    for (let i = 0; i < 5; i++) {
        const n = `HK-${Math.floor(100000 + Math.random() * 900000)}`;
        const exists = await prisma_1.default.supportTicket.findUnique({ where: { ticketNumber: n } });
        if (!exists)
            return n;
    }
    return `HK-${Date.now().toString().slice(-8)}`;
};
const displayName = async (userId) => {
    const u = await prisma_1.default.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : 'User';
};
// ════════════════════════════════════════════════════════════
//  USER ENDPOINTS — users can only ever see their own tickets
// ════════════════════════════════════════════════════════════
// POST /support/tickets
router.post('/tickets', (0, validate_1.validateBody)(schemas_1.createSupportTicketSchema), async (req, res) => {
    try {
        const { category, subject, message, priority, contactChannel, contactHandle } = req.body;
        const openCount = await prisma_1.default.supportTicket.count({
            where: { userId: req.user.id, status: { in: ['open', 'in_progress', 'awaiting_user'] } },
        });
        if (openCount >= 10) {
            return res.status(429).json({
                success: false,
                error: { code: 'TOO_MANY_OPEN_TICKETS', message: 'You have too many open tickets. Please wait for a response on existing requests.' },
            });
        }
        const ticketNumber = await generateTicketNumber();
        const authorName = await displayName(req.user.id);
        const ticket = await prisma_1.default.supportTicket.create({
            data: {
                ticketNumber,
                userId: req.user.id,
                category,
                subject,
                priority,
                contactChannel,
                contactHandle: contactHandle || null,
                messages: {
                    create: [
                        { authorId: req.user.id, authorRole: req.user.role, authorName, body: message },
                        {
                            authorRole: 'system',
                            authorName: 'HKFES Support',
                            body: `Thanks for reaching out! Ticket ${ticketNumber} has been created and assigned to our support queue. An agent will reply here shortly.`,
                        },
                    ],
                },
            },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
        });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'SUPPORT_TICKET_CREATED',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'support_ticket',
                targetEntityId: ticket.id,
                metadata: JSON.stringify({ ticketNumber, category, priority }),
            },
        });
        res.status(201).json({ success: true, data: ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// GET /support/tickets — current user's tickets
router.get('/tickets', async (req, res) => {
    try {
        const tickets = await prisma_1.default.supportTicket.findMany({
            where: { userId: req.user.id },
            orderBy: { lastActivityAt: 'desc' },
            include: {
                messages: { where: { isInternal: false }, orderBy: { createdAt: 'desc' }, take: 1 },
                _count: { select: { messages: { where: { isInternal: false } } } },
            },
        });
        res.json({ success: true, data: tickets });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// GET /support/tickets/:id — own ticket only (internal notes hidden)
router.get('/tickets/:id', async (req, res) => {
    try {
        const ticket = await prisma_1.default.supportTicket.findFirst({
            where: { id: req.params.id, userId: req.user.id },
            include: { messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } } },
        });
        if (!ticket)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
        res.json({ success: true, data: ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// POST /support/tickets/:id/messages — user reply on own ticket
router.post('/tickets/:id/messages', (0, validate_1.validateBody)(schemas_1.supportMessageSchema), async (req, res) => {
    try {
        const ticket = await prisma_1.default.supportTicket.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        if (!ticket)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
        if (ticket.status === 'closed') {
            return res.status(409).json({ success: false, error: { code: 'TICKET_CLOSED', message: 'This ticket is closed. Please open a new request.' } });
        }
        const msg = await prisma_1.default.supportMessage.create({
            data: {
                ticketId: ticket.id,
                authorId: req.user.id,
                authorRole: req.user.role,
                authorName: await displayName(req.user.id),
                body: req.body.body,
            },
        });
        await prisma_1.default.supportTicket.update({
            where: { id: ticket.id },
            data: {
                lastActivityAt: new Date(),
                // A user reply re-opens resolved tickets and moves "awaiting user" back to the agent
                ...(ticket.status === 'resolved' || ticket.status === 'awaiting_user' ? { status: 'open', resolvedAt: null } : {}),
            },
        });
        res.status(201).json({ success: true, data: msg });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// ════════════════════════════════════════════════════════════
//  ADMIN ENDPOINTS — admin / super_admin only
// ════════════════════════════════════════════════════════════
const adminOnly = (0, auth_1.requireRole)(ADMIN_ROLES);
// GET /support/admin/stats
router.get('/admin/stats', adminOnly, async (_req, res) => {
    try {
        const [open, inProgress, awaitingUser, resolved, urgent] = await Promise.all([
            prisma_1.default.supportTicket.count({ where: { status: 'open' } }),
            prisma_1.default.supportTicket.count({ where: { status: 'in_progress' } }),
            prisma_1.default.supportTicket.count({ where: { status: 'awaiting_user' } }),
            prisma_1.default.supportTicket.count({ where: { status: { in: ['resolved', 'closed'] } } }),
            prisma_1.default.supportTicket.count({ where: { priority: 'urgent', status: { in: ['open', 'in_progress'] } } }),
        ]);
        res.json({ success: true, data: { open, inProgress, awaitingUser, resolved, urgent } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// GET /support/admin/tickets?status=&search=
router.get('/admin/tickets', adminOnly, async (req, res) => {
    try {
        const status = req.query.status || 'all';
        const search = (req.query.search || '').trim();
        const where = {};
        if (status === 'active')
            where.status = { in: ['open', 'in_progress', 'awaiting_user'] };
        else if (status !== 'all')
            where.status = status;
        if (search) {
            where.OR = [
                { ticketNumber: { contains: search } },
                { subject: { contains: search } },
                { user: { email: { contains: search } } },
            ];
        }
        const tickets = await prisma_1.default.supportTicket.findMany({
            where,
            orderBy: [{ lastActivityAt: 'desc' }],
            take: 200,
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true } },
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                _count: { select: { messages: true } },
            },
        });
        res.json({ success: true, data: tickets });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// GET /support/admin/tickets/:id
router.get('/admin/tickets/:id', adminOnly, async (req, res) => {
    try {
        const ticket = await prisma_1.default.supportTicket.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true, createdAt: true, role: true } },
                messages: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!ticket)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
        res.json({ success: true, data: ticket });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// POST /support/admin/tickets/:id/reply  { body, isInternal? }
router.post('/admin/tickets/:id/reply', adminOnly, (0, validate_1.validateBody)(schemas_1.supportMessageSchema), async (req, res) => {
    try {
        const ticket = await prisma_1.default.supportTicket.findUnique({ where: { id: req.params.id } });
        if (!ticket)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
        const isInternal = !!req.body.isInternal;
        const msg = await prisma_1.default.supportMessage.create({
            data: {
                ticketId: ticket.id,
                authorId: req.user.id,
                authorRole: req.user.role,
                authorName: `${await displayName(req.user.id)} (Support)`,
                body: req.body.body,
                isInternal,
            },
        });
        if (!isInternal) {
            await prisma_1.default.supportTicket.update({
                where: { id: ticket.id },
                data: {
                    lastActivityAt: new Date(),
                    assignedAdminId: ticket.assignedAdminId || req.user.id,
                    status: ticket.status === 'open' || ticket.status === 'in_progress' ? 'awaiting_user' : ticket.status,
                },
            });
            (0, notifications_routes_1.pushUserNotification)(ticket.userId, {
                title: `Support replied · ${ticket.ticketNumber}`,
                message: req.body.body.length > 140 ? `${req.body.body.slice(0, 140)}…` : req.body.body,
                type: 'system',
            });
        }
        await prisma_1.default.auditLog.create({
            data: {
                eventType: isInternal ? 'SUPPORT_INTERNAL_NOTE' : 'SUPPORT_TICKET_REPLIED',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'support_ticket',
                targetEntityId: ticket.id,
                metadata: JSON.stringify({ ticketNumber: ticket.ticketNumber }),
            },
        });
        res.status(201).json({ success: true, data: msg });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
// PATCH /support/admin/tickets/:id  { status?, priority?, assignToMe? }
router.patch('/admin/tickets/:id', adminOnly, (0, validate_1.validateBody)(schemas_1.adminUpdateTicketSchema), async (req, res) => {
    try {
        const ticket = await prisma_1.default.supportTicket.findUnique({ where: { id: req.params.id } });
        if (!ticket)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
        const { status, priority, assignToMe } = req.body;
        const updated = await prisma_1.default.supportTicket.update({
            where: { id: ticket.id },
            data: {
                ...(status && { status }),
                ...(priority && { priority }),
                ...(assignToMe && { assignedAdminId: req.user.id }),
                ...(status === 'resolved' || status === 'closed' ? { resolvedAt: new Date() } : {}),
                lastActivityAt: new Date(),
            },
        });
        if (status && status !== ticket.status) {
            const label = status.replace('_', ' ');
            await prisma_1.default.supportMessage.create({
                data: { ticketId: ticket.id, authorRole: 'system', authorName: 'HKFES Support', body: `Ticket status changed to "${label}".` },
            });
            if (status === 'resolved' || status === 'closed') {
                (0, notifications_routes_1.pushUserNotification)(ticket.userId, {
                    title: `Ticket ${ticket.ticketNumber} ${label}`,
                    message: `Your support request "${ticket.subject}" has been marked as ${label}. Reply to the ticket if you still need help.`,
                    type: 'system',
                });
            }
        }
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'SUPPORT_TICKET_UPDATED',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'support_ticket',
                targetEntityId: ticket.id,
                metadata: JSON.stringify({ ticketNumber: ticket.ticketNumber, ...req.body }),
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'SUPPORT_ERROR', message: err.message } });
    }
});
exports.default = router;
