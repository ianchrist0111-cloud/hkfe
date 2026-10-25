import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateJwt, requireRole, AuthRequest } from '../middlewares/auth';
import { sendEmail } from '../services/emailService';

const router = Router();

async function notifyDepositStaff(subject: string, html: string) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['admin', 'super_admin'] }, status: 'active' },
    select: { email: true, role: true },
  });
  if (staff.length === 0) {
    console.warn('[Deposits] No active admin or super admin accounts to notify.');
    return;
  }
  await Promise.all(staff.map((member) => sendEmail({ to: member.email, subject, html })));
}

function depositMail(title: string, rows: Array<[string, string]>) {
  const body = rows.map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;">${label}</td><td style="padding:6px 0;color:#111;font-weight:600;">${value}</td></tr>`).join('');
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <h2 style="margin:0 0 8px;">${title}</h2>
      <p style="color:#444;font-size:14px;">This notice was sent to every active admin and super admin account.</p>
      <table style="border-collapse:collapse;font-size:14px;">${body}</table>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 1. PUBLIC / AUTHENTICATED USER ENDPOINTS
// ─────────────────────────────────────────────────────────────

// GET /api/v1/crypto/deposit-wallets
router.get('/deposit-wallets', async (_req, res: Response) => {
  try {
    const config = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
    const paymentsEnabled = config ? config.paymentsEnabled : false;

    if (!paymentsEnabled) {
      return res.json({ success: true, data: [], paymentsEnabled: false });
    }

    const wallets = await prisma.platformDepositWallet.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: wallets, paymentsEnabled: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CRYPTO_ERROR', message: err.message } });
  }
});

// GET /api/v1/crypto/transactions — User's personal crypto ledger
router.get('/transactions', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await prisma.cryptoTransaction.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CRYPTO_ERROR', message: err.message } });
  }
});

// POST /api/v1/crypto/deposits/intent — First submission: amount and payment name
router.post('/deposits/intent', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, paymentName } = req.body;
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, depositsBlocked: true, email: true, firstName: true, lastName: true },
    });
    if (!user || user.status === 'deleted' || user.depositsBlocked) {
      return res.status(403).json({
        success: false,
        error: { code: 'DEPOSITS_DISALLOWED', message: 'Deposits are not available for this account.' },
      });
    }

    const config = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
    if (config && !config.paymentsEnabled) {
      return res.status(403).json({
        success: false,
        error: { code: 'PAYMENTS_DISABLED', message: 'Inbound deposit payments are currently offline.' },
      });
    }

    const parsedAmount = parseFloat(amount);
    const name = typeof paymentName === 'string' ? paymentName.trim() : '';
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Enter the amount you want to send.' } });
    }
    if (name.length < 2) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_NAME', message: 'Enter a name for this payment.' } });
    }

    const tx = await prisma.cryptoTransaction.create({
      data: {
        userId,
        type: 'deposit',
        asset: 'UNSELECTED',
        network: 'UNSELECTED',
        amount: parsedAmount,
        amountUsd: parsedAmount,
        netAmount: parsedAmount,
        toAddress: 'AWAITING_NETWORK',
        status: 'AWAITING_PAYMENT',
        internalNotes: `Payment name: ${name}`,
        slaDueAt: new Date(Date.now() + 1000 * 60 * 45),
      },
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'CRYPTO_DEPOSIT_INTENT_SUBMITTED',
        actorId: userId,
        actorRole: req.user!.role,
        targetEntityType: 'CryptoTransaction',
        targetEntityId: tx.id,
        metadata: JSON.stringify({ amount: parsedAmount, paymentName: name }),
      },
    });

    const who = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    void notifyDepositStaff(
      `HKFES deposit started — ${parsedAmount} (${name})`,
      depositMail('Deposit request started', [
        ['Stage', '1 of 2 — amount and payment name'],
        ['Trader', who],
        ['Account email', user.email],
        ['Amount', String(parsedAmount)],
        ['Payment name', name],
        ['Record', tx.id],
      ]),
    ).catch((mailErr) => console.error('[Deposits] Staff notify failed:', mailErr));

    res.json({ success: true, data: tx });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTENT_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/crypto/deposits/:id/method — Record the network the trader selected
router.patch('/deposits/:id/method', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const claim = await prisma.cryptoTransaction.findUnique({ where: { id: req.params.id } });
    if (!claim || claim.userId !== req.user!.id || claim.type !== 'deposit') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deposit record not found.' } });
    }
    if (claim.status !== 'AWAITING_PAYMENT') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_SUBMITTED', message: 'This deposit was already marked as sent.' } });
    }

    const owner = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { status: true, depositsBlocked: true },
    });
    if (!owner || owner.status === 'deleted' || owner.depositsBlocked) {
      return res.status(403).json({
        success: false,
        error: { code: 'DEPOSITS_DISALLOWED', message: 'Deposits are not available for this account.' },
      });
    }

    const wallet = await prisma.platformDepositWallet.findFirst({
      where: { id: req.body.walletId, isActive: true },
    });
    if (!wallet) {
      return res.status(404).json({ success: false, error: { code: 'WALLET_NOT_FOUND', message: 'That payment option is not available.' } });
    }

    const updated = await prisma.cryptoTransaction.update({
      where: { id: claim.id },
      data: {
        asset: wallet.asset,
        network: wallet.network,
        toAddress: wallet.address,
      },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'METHOD_ERROR', message: err.message } });
  }
});

// POST /api/v1/crypto/deposits/claim — Second submission: payment has been sent
router.post('/deposits/claim', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { asset, network, amount, txHash, proofImageUrl, claimId, contactEmail } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, depositsBlocked: true, email: true, firstName: true, lastName: true },
    });
    if (!user || user.status === 'deleted' || user.depositsBlocked) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'DEPOSITS_DISALLOWED',
          message: 'Deposit crediting is currently restricted for your account by Compliance.',
        },
      });
    }

    const config = await prisma.platformConfig.findUnique({ where: { id: 'default' } });
    if (config && !config.paymentsEnabled) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PAYMENTS_DISABLED',
          message: 'Inbound deposit payments are currently offline or undergoing maintenance.',
        },
      });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0.' } });
    }
    if (!txHash || typeof txHash !== 'string' || txHash.trim().length < 8) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TXID', message: 'A valid blockchain Transaction Hash (TXID) is required.' } });
    }
    const emailNote = typeof contactEmail === 'string' ? contactEmail.trim() : '';
    if (emailNote && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNote)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'Enter a valid email address.' } });
    }

    const cleanHash = txHash.trim();

    // Prevent duplicate TXID submission
    const existing = await prisma.cryptoTransaction.findUnique({
      where: { txHash: cleanHash },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_TXID', message: 'This Transaction Hash (TXID) has already been claimed in our system.' },
      });
    }

    // Resolve platform custody address for this network or asset
    const walletConfig = await prisma.platformDepositWallet.findFirst({
      where: {
        isActive: true,
        network: network || undefined,
        asset: asset || undefined,
      },
    });
    const toAddress = walletConfig?.address || (network || 'PLATFORM_VAULT');

    const parsedAmount = parseFloat(amount);
    const note = [`Payment sent`, emailNote ? `Contact email: ${emailNote}` : ''].filter(Boolean).join('. ');

    let tx;
    if (claimId) {
      const existingClaim = await prisma.cryptoTransaction.findUnique({ where: { id: claimId } });
      if (!existingClaim || existingClaim.userId !== userId || existingClaim.type !== 'deposit') {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deposit request not found.' } });
      }
      if (existingClaim.status !== 'AWAITING_PAYMENT') {
        return res.status(400).json({ success: false, error: { code: 'ALREADY_SUBMITTED', message: 'This payment was already submitted.' } });
      }
      tx = await prisma.cryptoTransaction.update({
        where: { id: existingClaim.id },
        data: {
          asset: asset || existingClaim.asset,
          network: network || existingClaim.network,
          amount: parsedAmount,
          amountUsd: parsedAmount,
          netAmount: parsedAmount,
          toAddress,
          txHash: cleanHash,
          proofImageUrl: proofImageUrl || null,
          status: 'PENDING_VERIFICATION',
          internalNotes: [existingClaim.internalNotes, note].filter(Boolean).join('\n'),
        },
      });
    } else {
      tx = await prisma.cryptoTransaction.create({
        data: {
          userId,
          type: 'deposit',
          asset: asset || 'USDT',
          network: network || 'USDT_TRC20',
          amount: parsedAmount,
          amountUsd: parsedAmount,
          netAmount: parsedAmount,
          toAddress,
          txHash: cleanHash,
          proofImageUrl: proofImageUrl || null,
          status: 'PENDING_VERIFICATION',
          internalNotes: note,
          slaDueAt: new Date(Date.now() + 1000 * 60 * 45),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        eventType: 'CRYPTO_DEPOSIT_CLAIM_SUBMITTED',
        actorId: userId,
        actorRole: req.user!.role,
        targetEntityType: 'CryptoTransaction',
        targetEntityId: tx.id,
        metadata: JSON.stringify({ asset, network, amount: parsedAmount, txHash: cleanHash, contactEmail: emailNote }),
      },
    });

    const who = user ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email) : userId;
    void notifyDepositStaff(
      `HKFES payment sent — ${parsedAmount} ${asset || ''} on ${network || ''}`,
      depositMail('Payment marked as sent', [
        ['Stage', '2 of 2 — transfer submitted'],
        ['Trader', who],
        ['Account email', user?.email || ''],
        ['Contact email', emailNote || user?.email || ''],
        ['Amount', String(parsedAmount)],
        ['Asset', asset || ''],
        ['Network', network || ''],
        ['Receiving address', toAddress],
        ['Transaction reference', cleanHash],
        ['Record', tx.id],
      ]),
    ).catch((mailErr) => console.error('[Deposits] Staff notify failed:', mailErr));

    res.json({ success: true, data: tx });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CLAIM_SUBMISSION_ERROR', message: err.message } });
  }
});

// POST /api/v1/crypto/withdrawals/request — User requests withdrawal (atomic balance lock)
router.post('/withdrawals/request', authenticateJwt, async (req: AuthRequest, res: Response) => {
  try {
    const { asset, network, amount, destinationAddress } = req.body;
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, withdrawalsBlocked: true },
    });
    if (!user || user.status === 'suspended' || user.withdrawalsBlocked) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'WITHDRAWALS_DISALLOWED',
          message: user?.status === 'suspended'
            ? 'Account is suspended. Withdrawals are disabled.'
            : 'Withdrawals are currently restricted for your account by Compliance.',
        },
      });
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Invalid withdrawal amount.' } });
    }
    if (!destinationAddress || typeof destinationAddress !== 'string' || destinationAddress.trim().length < 15) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ADDRESS', message: 'Please provide a valid destination wallet address.' } });
    }

    const cleanAddress = destinationAddress.trim();
    const fee = network?.includes('TRC20') ? 1.5 : network?.includes('ERC20') ? 12.0 : network?.includes('BTC') ? 15.0 : 1.0;

    if (numAmount <= fee) {
      return res.status(400).json({ success: false, error: { code: 'AMOUNT_BELOW_FEE', message: `Withdrawal amount must exceed the network gas fee ($${fee}).` } });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.simulatedWallet.findUnique({ where: { userId } });
      if (!wallet || wallet.availableBalance < numAmount) {
        throw new Error('Insufficient unencumbered cash balance.');
      }

      // Lock amount: available balance is decremented immediately, total remains unchanged until dispatched
      await tx.simulatedWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: numAmount },
        },
      });

      const cryptoTx = await tx.cryptoTransaction.create({
        data: {
          userId,
          type: 'withdrawal',
          asset: asset || 'USDT',
          network: network || 'USDT_TRC20',
          amount: numAmount,
          amountUsd: numAmount,
          feeAmount: fee,
          netAmount: numAmount - fee,
          toAddress: cleanAddress,
          status: 'PENDING_REVIEW',
          slaDueAt: new Date(Date.now() + 1000 * 60 * 180), // 3-hour security audit SLA
        },
      });

      await tx.auditLog.create({
        data: {
          eventType: 'CRYPTO_WITHDRAWAL_REQUESTED',
          actorId: userId,
          actorRole: req.user!.role,
          targetEntityType: 'CryptoTransaction',
          targetEntityId: cryptoTx.id,
          metadata: JSON.stringify({ asset, network, amount: numAmount, destination: cleanAddress }),
        },
      });

      return cryptoTx;
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'WITHDRAWAL_REQUEST_ERROR', message: err.message } });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. ADMIN COMPLIANCE QUEUES & REVIEW WORKFLOWS
// ─────────────────────────────────────────────────────────────

// GET /api/v1/crypto/admin/deposits — List all pending/recent deposit claims
router.get('/admin/deposits', authenticateJwt, requireRole(['admin', 'super_admin']), async (_req: AuthRequest, res: Response) => {
  try {
    const claims = await prisma.cryptoTransaction.findMany({
      where: { type: 'deposit' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ success: true, data: claims });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ADMIN_CRYPTO_ERROR', message: err.message } });
  }
});

// POST /api/v1/crypto/admin/deposits/:id/approve — Sign off and credit ledger balance
router.post('/admin/deposits/:id/approve', authenticateJwt, requireRole(['admin', 'super_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const claimId = req.params.id;
    const adminId = req.user!.id;
    const { creditAmount, notes } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.cryptoTransaction.findUnique({
        where: { id: claimId },
        include: { user: { include: { wallet: true } } },
      });

      if (!claim || claim.type !== 'deposit') {
        throw new Error('Deposit record not found.');
      }
      if (claim.status === 'COMPLETED') {
        throw new Error('This deposit claim has already been approved and credited.');
      }
      if (claim.status === 'AWAITING_PAYMENT') {
        throw new Error('The trader has not marked this payment as sent yet.');
      }

      const wallet = claim.user.wallet;
      if (!wallet) throw new Error('User wallet does not exist.');

      const finalCredit = creditAmount ? parseFloat(creditAmount) : claim.amount;
      const balanceBefore = wallet.totalBalance;
      const balanceAfter = balanceBefore + finalCredit;

      // 1. Credit wallet
      await tx.simulatedWallet.update({
        where: { id: wallet.id },
        data: {
          totalBalance: balanceAfter,
          availableBalance: { increment: finalCredit },
        },
      });

      // 2. Create official ledger transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: claim.userId,
          type: 'deposit',
          amount: finalCredit,
          balanceBefore,
          balanceAfter,
          description: `Crypto Deposit (${claim.asset}-${claim.network}) - TXID: ${claim.txHash?.slice(0, 10)}...`,
          status: 'completed',
          referenceId: claim.id,
          referenceType: 'CryptoTransaction',
        },
      });

      // 3. Mark crypto ticket COMPLETED
      const updated = await tx.cryptoTransaction.update({
        where: { id: claimId },
        data: {
          status: 'COMPLETED',
          internalNotes: notes || null,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          completedAt: new Date(),
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          eventType: 'ADMIN_CRYPTO_DEPOSIT_APPROVED',
          actorId: adminId,
          actorRole: req.user!.role,
          targetEntityType: 'CryptoTransaction',
          targetEntityId: claimId,
          metadata: JSON.stringify({
            creditedAmount: finalCredit,
            userEmail: claim.user.email,
            txHash: claim.txHash,
          }),
        },
      });

      return updated;
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'APPROVE_ERROR', message: err.message } });
  }
});

// POST /api/v1/crypto/admin/deposits/:id/reject — Decline deposit claim
router.post('/admin/deposits/:id/reject', authenticateJwt, requireRole(['admin', 'super_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const claimId = req.params.id;
    const adminId = req.user!.id;
    const { reason, notes } = req.body;

    const claim = await prisma.cryptoTransaction.findUnique({ where: { id: claimId } });
    if (!claim) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Claim not found.' } });

    const updated = await prisma.cryptoTransaction.update({
      where: { id: claimId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason || 'Transaction could not be verified on the blockchain explorer.',
        internalNotes: notes ? [claim.internalNotes, notes].filter(Boolean).join('\n') : claim.internalNotes,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'ADMIN_CRYPTO_DEPOSIT_REJECTED',
        actorId: adminId,
        actorRole: req.user!.role,
        targetEntityType: 'CryptoTransaction',
        targetEntityId: claimId,
        metadata: JSON.stringify({ reason }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'REJECT_ERROR', message: err.message } });
  }
});

// GET /api/v1/crypto/admin/withdrawals — List all pending/recent withdrawal requests
router.get('/admin/withdrawals', authenticateJwt, requireRole(['admin', 'super_admin']), async (_req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.cryptoTransaction.findMany({
      where: { type: 'withdrawal' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            kycStatus: true,
            wallet: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ success: true, data: requests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ADMIN_CRYPTO_ERROR', message: err.message } });
  }
});

// POST /api/v1/crypto/admin/withdrawals/:id/approve — Finalize dispatch with platform TXID
router.post('/admin/withdrawals/:id/approve', authenticateJwt, requireRole(['admin', 'super_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const withdrawalId = req.params.id;
    const adminId = req.user!.id;
    const { txHash, notes } = req.body;

    if (!txHash || typeof txHash !== 'string' || txHash.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: { code: 'TXID_REQUIRED', message: 'A broadcasted blockchain Transaction Hash (TXID) is required to finalize withdrawal.' },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wdr = await tx.cryptoTransaction.findUnique({
        where: { id: withdrawalId },
        include: { user: { include: { wallet: true } } },
      });

      if (!wdr || wdr.type !== 'withdrawal') throw new Error('Withdrawal request not found.');
      if (wdr.status === 'COMPLETED') throw new Error('Withdrawal already finalized.');

      const wallet = wdr.user.wallet;
      if (!wallet) throw new Error('Wallet not found.');

      // Finalize debit from total balance
      const balanceBefore = wallet.totalBalance;
      const balanceAfter = balanceBefore - wdr.amount;

      await tx.simulatedWallet.update({
        where: { id: wallet.id },
        data: {
          totalBalance: balanceAfter,
        },
      });

      // Ledger entry
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: wdr.userId,
          type: 'withdrawal',
          amount: -wdr.amount,
          balanceBefore,
          balanceAfter,
          description: `Crypto Withdrawal (${wdr.asset}-${wdr.network}) to ${wdr.toAddress.slice(0, 8)}... - TXID: ${txHash.slice(0, 10)}...`,
          status: 'completed',
          referenceId: wdr.id,
          referenceType: 'CryptoTransaction',
        },
      });

      // Update ticket
      const updated = await tx.cryptoTransaction.update({
        where: { id: withdrawalId },
        data: {
          status: 'COMPLETED',
          txHash: txHash.trim(),
          internalNotes: notes || null,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          eventType: 'ADMIN_CRYPTO_WITHDRAWAL_APPROVED',
          actorId: adminId,
          actorRole: req.user!.role,
          targetEntityType: 'CryptoTransaction',
          targetEntityId: withdrawalId,
          metadata: JSON.stringify({
            amount: wdr.amount,
            txHash: txHash.trim(),
            destination: wdr.toAddress,
            userEmail: wdr.user.email,
          }),
        },
      });

      return updated;
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'APPROVE_ERROR', message: err.message } });
  }
});

// POST /api/v1/crypto/admin/withdrawals/:id/reject — Reject & unlock reserved balance
router.post('/admin/withdrawals/:id/reject', authenticateJwt, requireRole(['admin', 'super_admin']), async (req: AuthRequest, res: Response) => {
  try {
    const withdrawalId = req.params.id;
    const adminId = req.user!.id;
    const { reason, notes } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const wdr = await tx.cryptoTransaction.findUnique({
        where: { id: withdrawalId },
        include: { user: { include: { wallet: true } } },
      });

      if (!wdr || wdr.type !== 'withdrawal') throw new Error('Withdrawal request not found.');
      if (wdr.status !== 'PENDING_REVIEW') throw new Error('Ticket is not in review status.');

      const wallet = wdr.user.wallet;
      if (!wallet) throw new Error('Wallet not found.');

      // Restore locked amount back to available balance!
      await tx.simulatedWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: wdr.amount },
        },
      });

      const updated = await tx.cryptoTransaction.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason || 'Security review declined. Funds returned to your available balance.',
          internalNotes: notes || null,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          eventType: 'ADMIN_CRYPTO_WITHDRAWAL_REJECTED',
          actorId: adminId,
          actorRole: req.user!.role,
          targetEntityType: 'CryptoTransaction',
          targetEntityId: withdrawalId,
          metadata: JSON.stringify({
            amountUnlocked: wdr.amount,
            reason,
            userEmail: wdr.user.email,
          }),
        },
      });

      return updated;
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'REJECT_ERROR', message: err.message } });
  }
});

export default router;
