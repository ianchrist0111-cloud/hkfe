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
const generateCaseReference = () => {
    const ts = Date.now().toString(36).toUpperCase().slice(-5);
    const rnd = Math.random().toString(36).toUpperCase().slice(2, 6);
    return `KYC-${ts}${rnd}`;
};
/** Returns an error response if the applicant is not allowed to modify their KYC data right now. */
const ensureEditable = async (userId, res) => {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId }, include: { kycRecord: true } });
    if (!user) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        return false;
    }
    if (user.kycStatus === 'approved') {
        res.status(409).json({ success: false, error: { code: 'KYC_ALREADY_APPROVED', message: 'Your identity is already verified.' } });
        return false;
    }
    if (user.kycStatus === 'pending' && user.kycRecord?.submittedAt) {
        res.status(409).json({
            success: false,
            error: { code: 'KYC_UNDER_REVIEW', message: 'Your application is under review and cannot be modified until a decision is made.' },
        });
        return false;
    }
    return true;
};
// GET /kyc/status — lightweight status (no document images)
router.get('/status', auth_1.authenticateJwt, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            include: { kycRecord: true },
        });
        if (!user)
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        const r = user.kycRecord;
        res.json({
            success: true,
            data: {
                kycStatus: user.kycStatus,
                submitted: !!r?.submittedAt,
                caseReference: r?.caseReference || null,
                submittedAt: r?.submittedAt || null,
                reviewedAt: r?.reviewedAt || null,
                reviewNotes: r?.notes || null,
                documentType: r?.documentType || null,
                documentNumberMasked: r?.documentNumber ? `•••• ${r.documentNumber.slice(-4)}` : null,
                country: r?.country || null,
                profile: {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    dateOfBirth: user.dateOfBirth,
                    phoneNumber: user.phoneNumber,
                },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
    }
});
// POST /kyc/personal-details (Step 1)
router.post('/personal-details', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.kycPersonalDetailsSchema), async (req, res) => {
    try {
        if (!(await ensureEditable(req.user.id, res)))
            return;
        const { firstName, lastName, dateOfBirth, phoneNumber, nationality, occupation, sourceOfFunds } = req.body;
        await prisma_1.default.user.update({
            where: { id: req.user.id },
            data: { firstName, lastName, dateOfBirth, phoneNumber },
        });
        await prisma_1.default.kYCRecord.upsert({
            where: { userId: req.user.id },
            create: { userId: req.user.id, nationality, occupation, sourceOfFunds },
            update: { nationality, occupation, sourceOfFunds },
        });
        res.json({ success: true, data: { message: 'Personal details saved.', step: 1, nextStep: 'address' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
    }
});
// POST /kyc/address (Step 2)
router.post('/address', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.kycAddressSchema), async (req, res) => {
    try {
        if (!(await ensureEditable(req.user.id, res)))
            return;
        const { addressLine1, addressLine2, city, state, zipCode, country } = req.body;
        const data = { addressLine1, addressLine2: addressLine2 || null, city, state, zipCode, country: country || 'US' };
        await prisma_1.default.kYCRecord.upsert({
            where: { userId: req.user.id },
            create: { userId: req.user.id, ...data },
            update: data,
        });
        res.json({ success: true, data: { message: 'Address details saved.', step: 2, nextStep: 'document' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
    }
});
// POST /kyc/document (Final step — submits application to compliance queue)
router.post('/document', auth_1.authenticateJwt, (0, validate_1.validateBody)(schemas_1.kycDocumentSchema), async (req, res) => {
    try {
        if (!(await ensureEditable(req.user.id, res)))
            return;
        const { documentType, documentNumber, documentExpiry, documentRef, documentBackRef, selfieRef } = req.body;
        if (documentType !== 'passport' && !documentBackRef) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Please upload the back side of your document.' },
            });
        }
        const caseReference = generateCaseReference();
        const submittedAt = new Date();
        const docData = {
            documentType,
            documentNumber,
            documentExpiry: documentExpiry || null,
            documentRef,
            documentBackRef: documentBackRef || null,
            selfieRef,
            caseReference,
            submittedAt,
            reviewedAt: null,
            reviewedByAdminId: null,
            notes: null,
        };
        await prisma_1.default.kYCRecord.upsert({
            where: { userId: req.user.id },
            create: { userId: req.user.id, ...docData },
            update: docData,
        });
        await prisma_1.default.user.update({ where: { id: req.user.id }, data: { kycStatus: 'pending' } });
        await prisma_1.default.auditLog.create({
            data: {
                eventType: 'KYC_SUBMITTED',
                actorId: req.user.id,
                actorRole: req.user.role,
                targetEntityType: 'user',
                targetEntityId: req.user.id,
                metadata: JSON.stringify({ documentType, caseReference }),
            },
        });
        (0, notifications_routes_1.pushUserNotification)(req.user.id, {
            title: 'Verification submitted',
            message: `Your identity verification (${caseReference}) is now in the compliance review queue. We typically respond within 1–2 business hours.`,
            type: 'kyc',
        });
        res.json({
            success: true,
            data: {
                message: 'Application submitted for compliance review.',
                kycStatus: 'pending',
                submitted: true,
                caseReference,
                submittedAt,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
    }
});
exports.default = router;
