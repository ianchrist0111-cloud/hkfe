import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateJwt, AuthRequest } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { kycPersonalDetailsSchema, kycAddressSchema, kycDocumentSchema } from '../schemas';
import { pushUserNotification } from './notifications.routes';

const router = Router();

const generateCaseReference = () => {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rnd = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `KYC-${ts}${rnd}`;
};

/** Returns an error response if the applicant is not allowed to modify their KYC data right now. */
const ensureEditable = async (userId: string, res: Response): Promise<boolean> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { kycRecord: true } });
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
router.get('/status', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { kycRecord: true },
    });

    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

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
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
  }
});

// POST /kyc/personal-details (Step 1)
router.post('/personal-details', authenticateJwt, validateBody(kycPersonalDetailsSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureEditable(req.user!.id, res))) return;
    const { firstName, lastName, dateOfBirth, phoneNumber, nationality, occupation, sourceOfFunds } = req.body;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { firstName, lastName, dateOfBirth, phoneNumber },
    });

    await prisma.kYCRecord.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, nationality, occupation, sourceOfFunds },
      update: { nationality, occupation, sourceOfFunds },
    });

    res.json({ success: true, data: { message: 'Personal details saved.', step: 1, nextStep: 'address' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
  }
});

// POST /kyc/address (Step 2)
router.post('/address', authenticateJwt, validateBody(kycAddressSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureEditable(req.user!.id, res))) return;
    const { addressLine1, addressLine2, city, state, zipCode, country } = req.body;
    const data = { addressLine1, addressLine2: addressLine2 || null, city, state, zipCode, country: country || 'US' };

    await prisma.kYCRecord.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...data },
      update: data,
    });

    res.json({ success: true, data: { message: 'Address details saved.', step: 2, nextStep: 'document' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
  }
});

// POST /kyc/document (Final step — submits application to compliance queue)
router.post('/document', authenticateJwt, validateBody(kycDocumentSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!(await ensureEditable(req.user!.id, res))) return;
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

    await prisma.kYCRecord.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...docData },
      update: docData,
    });

    await prisma.user.update({ where: { id: req.user!.id }, data: { kycStatus: 'pending' } });

    await prisma.auditLog.create({
      data: {
        eventType: 'KYC_SUBMITTED',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntityType: 'user',
        targetEntityId: req.user!.id,
        metadata: JSON.stringify({ documentType, caseReference }),
      },
    });

    pushUserNotification(req.user!.id, {
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
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: err.message } });
  }
});

export default router;
