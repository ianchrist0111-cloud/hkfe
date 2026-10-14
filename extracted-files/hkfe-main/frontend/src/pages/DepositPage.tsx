import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { api } from '../lib/api';
import { triggerFintechAlert } from '../lib/pushNotifications';
import { downloadReceiptImage, readScreenshotFile } from '../lib/receiptImage';
import {
  IconArrowLeft,
  IconClock,
  IconAlertTriangle,
  IconUploadCloud,
  IconCopy,
  IconX,
  IconDownload,
} from '../components/common/Icons';
import styles from './FlowPage.module.css';

interface DepositWallet {
  id: string;
  asset: string;
  network: string;
  address: string;
  memoOrTag?: string | null;
  qrCodeUrl?: string | null;
  minDeposit: number;
  details?: string | null;
  isActive: boolean;
}

export default function DepositPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isDepositBlocked = Boolean(user?.depositsBlocked);

  // Dynamic Wallets & Payment Status from Backend
  const [loading, setLoading] = useState(true);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [wallets, setWallets] = useState<DepositWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');

  const [copied, setCopied] = useState(false);

  // Claim Modal State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimAmount, setClaimAmount] = useState('100');
  const [txHash, setTxHash] = useState('');
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [paymentName, setPaymentName] = useState('');
  const [intentId, setIntentId] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [startingIntent, setStartingIntent] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);

  // Fetch wallets on mount
  useEffect(() => {
    let isMounted = true;
    const loadWallets = async () => {
      setLoading(true);
      try {
        const res = await api.getCryptoDepositWallets();
        if (isMounted && res.success) {
          const isEnabled = res.paymentsEnabled !== false && (Array.isArray(res.data) ? res.data.length > 0 : false);
          setPaymentsEnabled(res.paymentsEnabled !== false);
          const activeWallets = Array.isArray(res.data) ? res.data.filter((w: DepositWallet) => w.isActive) : [];
          setWallets(activeWallets);
          if (activeWallets.length > 0) {
            setClaimAmount(String(Math.max(activeWallets[0].minDeposit || 10, 100)));
          }
        }
      } catch (err) {
        console.error('Failed to load deposit wallets', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadWallets();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeWallet = wallets.find(w => w.id === selectedWalletId);

  useEffect(() => {
    setQrFailed(false);
    if (!intentId || !selectedWalletId) return;
    api.selectCryptoDepositMethod(intentId, selectedWalletId).catch(() => {});
  }, [intentId, selectedWalletId]);

  const handleCopy = () => {
    if (!activeWallet) return;
    navigator.clipboard.writeText(activeWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProofPreview(await readScreenshotFile(file));
      setClaimError(null);
    } catch (err: any) {
      setProofPreview(null);
      setClaimError(err.message || 'Could not read that screenshot.');
    }
  };

  const saveConfirmationScreenshot = () => {
    if (!activeWallet) return;
    downloadReceiptImage({
      title: 'Deposit claim registered',
      filename: `hkfes-deposit-${activeWallet.asset}.png`,
      rows: [
        ['Amount', `${claimAmount} ${activeWallet.asset}`],
        ['Network', activeWallet.network],
        ['Payment name', paymentName || '—'],
        ['Email', contactEmail || '—'],
        ['Reference', txHash || '—'],
        ['Status', 'Pending compliance sign-off'],
        ['Saved', new Date().toLocaleString()],
      ],
    });
  };

  const handleStartIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);
    const amt = parseFloat(claimAmount);
    if (!paymentName.trim()) {
      setClaimError('Enter a name for this payment.');
      return;
    }
    if (!amt || amt <= 0) {
      setClaimError('Enter the amount you want to send.');
      return;
    }
    setStartingIntent(true);
    try {
      const res = await api.startCryptoDeposit({ amount: amt, paymentName: paymentName.trim() });
      if (!res.success || !res.data?.id) {
        throw new Error(res.error?.message || 'Could not register this deposit.');
      }
      setIntentId(res.data.id);
    } catch (err: any) {
      setClaimError(err.message || 'Could not register this deposit.');
    } finally {
      setStartingIntent(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !intentId) return;
    setClaimError(null);

    const amt = parseFloat(claimAmount);
    if (!amt || amt <= 0) {
      setClaimError('Please enter a valid amount.');
      return;
    }
    if (amt < (activeWallet.minDeposit || 0)) {
      setClaimError(`The minimum allowed deposit is ${activeWallet.minDeposit} ${activeWallet.asset}.`);
      return;
    }
    if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setClaimError('Enter the email address to attach to this payment.');
      return;
    }
    if (!txHash.trim() || txHash.trim().length < 8) {
      setClaimError('Please provide a valid blockchain Transaction Hash (TXID) or transfer reference.');
      return;
    }
    if (!confirmedCheck) {
      setClaimError('Please confirm that you transferred on the exact matching network.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitCryptoDepositClaim({
        claimId: intentId,
        asset: activeWallet.asset,
        network: activeWallet.network,
        amount: amt,
        txHash: txHash.trim(),
        proofImageUrl: proofPreview || undefined,
        contactEmail: contactEmail.trim(),
      });
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to submit the payment.');
      }

      setClaimSubmitted(true);
      setShowClaimModal(false);
      triggerFintechAlert({
        title: `Payment submitted: ${amt} ${activeWallet.asset}`,
        message: `Admin and super admin were notified about your ${activeWallet.network} transfer.`,
        type: 'deposit',
        amount: amt,
        deepLink: '/wallet',
        actionText: 'View Ledger',
      });
    } catch (err: any) {
      setClaimError(err.message || 'Failed to submit deposit verification claim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Case 1: Claim Submitted Successfully ───────────────────
  if (claimSubmitted && activeWallet) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ maxWidth: 520 }}>
          <div className={styles.success}>
            <div className={styles.successIcon} style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)' }}>
              <IconClock size={36} color="var(--color-warning)" />
            </div>
            <h2 style={{ margin: '0 0 6px' }}>Deposit Claim Registered</h2>
            <p className={styles.successAmt} style={{ color: 'var(--brand-mint-500)', fontSize: 'var(--text-2xl)', margin: '0 0 12px' }}>
              +{parseFloat(claimAmount).toLocaleString()} {activeWallet.asset}
            </p>

            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              textAlign: 'left',
              width: '100%',
              margin: '0 0 16px',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Audit Status:</span>
                <span style={{ color: 'var(--color-warning)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IconClock size={12} /> Pending Compliance Sign-off
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Transfer Network:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeWallet.network}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Registered TXID / Reference:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-mint-500)' }}>
                  {txHash.length > 18 ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}` : txHash}
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 217, 160, 0.08)',
              borderLeft: '3px solid var(--brand-mint-500)',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              padding: '10px 12px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              textAlign: 'left',
              marginBottom: 20,
              width: '100%',
            }}>
              💡 Our custodial risk engine will credit your ledger balance once network confirmations are verified by administration.
            </div>

            <div className={styles.successActions}>
              <button type="button" className={styles.btnSecondary} onClick={saveConfirmationScreenshot}>
                <IconDownload size={16} /> Save screenshot
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setClaimSubmitted(false);
                  setIntentId(null);
                  setSelectedWalletId('');
                  setPaymentName('');
                  setTxHash('');
                  setProofPreview(null);
                  setConfirmedCheck(false);
                  setClaimError(null);
                }}
              >
                Deposit Another Asset
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => navigate('/wallet')}
              >
                Go to Wallet
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Case 2: Loading State ─────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ maxWidth: 480, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '3px solid var(--brand-mint-500)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
              Checking deposit gateways & custody vaults...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Case 3: Payments Disabled or Zero Wallets Configured ───
  // Clean state: NO dummy details shown!
  if (!paymentsEnabled || wallets.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ maxWidth: 500, textAlign: 'center', padding: '36px 28px' }}>
          <div style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'rgba(234, 179, 8, 0.12)',
            color: 'var(--accent-gold)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            border: '1px solid rgba(234, 179, 8, 0.3)',
          }}>
            <IconClock size={30} />
          </div>

          <h2 style={{ margin: '0 0 8px', fontSize: 'var(--text-xl)', color: 'var(--text-primary)', fontWeight: 800 }}>
            Deposit Services Currently Offline
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.5, margin: '0 0 24px' }}>
            Inbound payment gateways are currently undergoing scheduled maintenance or administrative review.
            Deposit addresses and receiving methods will be restored once published by administration.
          </p>

          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            textAlign: 'left',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Gateway Status:</span>
              <span style={{ color: 'var(--color-loss)', fontWeight: 600 }}>● Temporarily Inactive</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Settlement Vault:</span>
              <span style={{ color: 'var(--text-primary)' }}>Custody Cold Storage</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Assistance:</span>
              <span style={{ color: 'var(--brand-mint-500)', fontWeight: 600 }}>Available 24/7 via Helpdesk</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => window.dispatchEvent(new CustomEvent('hkfes:open-support', { detail: { category: 'deposit', subject: 'Inbound Deposit Status' } }))}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Contact Support Desk
            </button>
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              ← Return to Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Case 4: Payments Active — Dynamic Admin-Published Wallets ───
  return (
    <div className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 540 }}>
        {/* Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className={styles.back}
              onClick={() => navigate('/wallet')}
            >
              <IconArrowLeft size={16} /> Back to Wallet
            </button>
            <span style={{
              fontSize: '10px',
              background: 'rgba(0, 217, 160, 0.12)',
              color: 'var(--brand-mint-500)',
              border: '1px solid rgba(0, 217, 160, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              ● Institutional Custody
            </span>
          </div>

          <div>
            <h2 style={{ margin: '4px 0 2px' }}>Inbound Deposit</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', margin: 0 }}>
              Transfer funds to your official HKFES custody vault address below.
            </p>
          </div>
        </div>

        {/* Compliance Restriction Warning Banner */}
        {isDepositBlocked && (
          <div style={{
            background: 'var(--color-loss-bg)',
            border: '1px solid var(--color-loss)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: 'var(--text-xs)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-loss)', fontWeight: 700, marginBottom: 4 }}>
              <IconAlertTriangle size={15} />
              <span>Deposits Restricted by Compliance</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Inbound deposit crediting is temporarily restricted for this account. If you need assistance or believe this is an error, please reach out to our Support Desk.
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('hkfes:open-support', { detail: { category: 'deposit', subject: 'Inbound Deposit Restriction Clearance' } }))}
              style={{
                marginTop: 8,
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Contact Compliance Desk →
            </button>
          </div>
        )}

        {/* Step 1: amount and payment name */}
        <form onSubmit={handleStartIntent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              Amount to send
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={claimAmount}
              onChange={e => setClaimAmount(e.target.value)}
              disabled={Boolean(intentId) || isDepositBlocked}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              Payment name
            </label>
            <input
              type="text"
              required
              placeholder="Name this payment, for example salary top-up"
              value={paymentName}
              onChange={e => setPaymentName(e.target.value)}
              disabled={Boolean(intentId) || isDepositBlocked}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          {claimError && !intentId && (
            <div style={{ color: 'var(--color-loss)', fontSize: '12px' }}>{claimError}</div>
          )}
          {!intentId && (
            <button type="submit" className={styles.btnPrimary} disabled={startingIntent || isDepositBlocked} style={{ width: '100%' }}>
              {startingIntent ? 'Sending to admin...' : 'Submit payment request'}
            </button>
          )}
          {intentId && (
            <div style={{ fontSize: '12px', color: 'var(--brand-mint-500)' }}>
              Request sent to admin and super admin. Choose how you will pay.
            </div>
          )}
        </form>

        {/* Step 2: the published payment options */}
        {intentId && (
        <div>
          <label htmlFor="deposit-method" style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            Payment option
          </label>
          <select
            id="deposit-method"
            value={selectedWalletId}
            onChange={e => setSelectedWalletId(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <option value="">Select TRC20, Bitcoin, or another published option</option>
            {wallets.map(w => (
              <option key={w.id} value={w.id}>
                {w.asset} — {w.network}
              </option>
            ))}
          </select>
        </div>
        )}

        {/* QR Code & Official Address Display */}
        {activeWallet && (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-card)',
          }}>
            {/* QR Image: Either Admin Uploaded QR or Dynamically Generated QR */}
            <div style={{
              background: '#ffffff',
              padding: 10,
              borderRadius: 'var(--radius-md)',
              display: 'inline-block',
              marginBottom: 14,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              maxWidth: 200,
              width: '100%',
            }}>
              {activeWallet.qrCodeUrl && !qrFailed ? (
                <img
                  src={activeWallet.qrCodeUrl}
                  alt={`${activeWallet.asset} QR Code`}
                  onError={() => setQrFailed(true)}
                  style={{ display: 'block', width: '100%', aspectRatio: '1/1', objectFit: 'contain', borderRadius: 4 }}
                />
              ) : (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(activeWallet.address)}&bgcolor=ffffff&color=07090e&margin=0`}
                  alt="Deposit QR Code"
                  width={170}
                  height={170}
                  style={{ display: 'block', margin: '0 auto' }}
                />
              )}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 6 }}>
              Official Platform Custody Vault ({activeWallet.asset} - {activeWallet.network})
            </div>

            {/* Address Display Box */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                wordBreak: 'break-all',
                textAlign: 'center',
                letterSpacing: '0.04em',
                padding: '4px',
              }}>
                {activeWallet.address}
              </span>

              {activeWallet.memoOrTag && (
                <div style={{ fontSize: '11px', color: 'var(--accent-gold)', background: 'rgba(234, 179, 8, 0.1)', padding: '6px', borderRadius: 4 }}>
                  Destination Tag / Memo: <strong>{activeWallet.memoOrTag}</strong> (Required for transfer)
                </div>
              )}

              <button
                type="button"
                onClick={handleCopy}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  background: copied ? 'var(--brand-mint-500)' : 'var(--bg-elevated)',
                  color: copied ? '#07090e' : 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'var(--transition-fast)',
                }}
              >
                {copied ? '✓ Copied to Clipboard' : <><IconCopy size={15} /> Copy Deposit Address</>}
              </button>
            </div>

            {/* Admin Custom Instructions / Details */}
            {activeWallet.details && (
              <div style={{
                marginTop: 12,
                background: 'rgba(0, 217, 160, 0.06)',
                borderLeft: '3px solid var(--brand-mint-500)',
                padding: '8px 12px',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                textAlign: 'left',
              }}>
                💡 {activeWallet.details}
              </div>
            )}
          </div>
        )}

        {/* Step 3: email form after the transfer is sent */}
        {intentId && activeWallet && (
        <form onSubmit={handleSubmitClaim} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Payment sent
          </div>
          {claimError && (
            <div style={{ color: 'var(--color-loss)', fontSize: '12px' }}>{claimError}</div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              Email
            </label>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              Transaction hash or transfer reference
            </label>
            <input
              type="text"
              required
              value={txHash}
              onChange={e => setTxHash(e.target.value)}
              placeholder="Paste the transaction reference"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
              Payment screenshot
            </label>
            <div style={{
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              {proofPreview ? (
                <img src={proofPreview} alt="Payment screenshot" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, background: '#fff' }} />
              ) : (
                <IconUploadCloud size={20} color="var(--text-muted)" />
              )}
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', flex: 1 }}>
                {proofPreview ? 'Screenshot attached. Choose another file to replace it.' : 'Attach a screenshot of the transfer (optional).'}
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'block', marginTop: 6, maxWidth: '100%' }} />
              </label>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={confirmedCheck} onChange={e => setConfirmedCheck(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              I sent {claimAmount} {activeWallet.asset} on {activeWallet.network} to the address above.
            </span>
          </label>
          <button type="submit" className={styles.btnPrimary} disabled={isSubmitting || isDepositBlocked} style={{ width: '100%' }}>
            {isSubmitting ? 'Submitting...' : 'Submit payment confirmation'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            This confirmation is emailed to the admin and the super admin, and saved on the deposit record.
          </p>
        </form>
        )}
      </div>

      {/* ─── Verification Claim Modal ───────────────────────────── */}
      {showClaimModal && activeWallet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: 480,
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: 'var(--shadow-modal)',
            position: 'relative',
          }}>
            <button
              onClick={() => setShowClaimModal(false)}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <IconX size={20} />
            </button>

            <h3 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', color: 'var(--text-primary)' }}>
              Confirm Deposit Claim
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Register your transaction on {activeWallet.network} for manual verification and ledger balance credit.
            </p>

            {claimError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--color-loss)',
                color: 'var(--color-loss)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                marginBottom: 14,
              }}>
                {claimError}
              </div>
            )}

            <form onSubmit={handleSubmitClaim} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Amount Transferred */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                  Nominal Amount Sent ({activeWallet.asset}) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    required
                    min={activeWallet.minDeposit || 0}
                    value={claimAmount}
                    onChange={e => setClaimAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--brand-mint-500)',
                    fontWeight: 700,
                  }}>
                    {activeWallet.asset}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Minimum: {activeWallet.minDeposit} {activeWallet.asset}
                </span>
              </div>

              {/* Transaction Hash / Reference */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                  Transaction Hash (TXID) / Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste transaction hash or transfer reference"
                  value={txHash}
                  onChange={e => setTxHash(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              </div>

              {/* Optional Proof Screenshot */}
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                  Transfer Receipt / Screenshot (Optional)
                </label>
                <div style={{
                  border: '1px dashed var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {proofPreview ? (
                    <div style={{ width: 44, height: 44, borderRadius: 4, overflow: 'hidden', background: '#fff' }}>
                      <img src={proofPreview} alt="Receipt" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <IconUploadCloud size={20} color="var(--text-muted)" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}
                  />
                </div>
              </div>

              {/* Matching Network Confirmation Checkbox */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={confirmedCheck}
                  onChange={e => setConfirmedCheck(e.target.checked)}
                  style={{ marginTop: 2, accentColor: 'var(--brand-mint-500)' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  I confirm that I transferred funds via <strong>{activeWallet.network}</strong> to the HKFES vault address displayed on this page.
                </span>
              </label>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ flex: 1 }}
                  onClick={() => setShowClaimModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ flex: 1.5 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting Claim...' : 'Register Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}