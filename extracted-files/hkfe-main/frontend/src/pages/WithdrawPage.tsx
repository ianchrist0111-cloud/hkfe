import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, useAuthStore } from '../store';
import { triggerFintechAlert } from '../lib/pushNotifications';
import {
  IconArrowLeft,
  IconAlertTriangle,
  IconShieldCheck,
  IconClock,
  IconCheck,
  IconX,
  IconExternalLink
} from '../components/common/Icons';
import styles from './FlowPage.module.css';

interface WithdrawalNetwork {
  id: string;
  asset: 'USDT' | 'BTC';
  label: string;
  prefixDesc: string;
  fee: number;
  minAmount: number;
  eta: string;
  validate: (addr: string) => boolean;
  samplePlaceholder: string;
}

const NETWORKS: WithdrawalNetwork[] = [
  {
    id: 'USDT_TRC20',
    asset: 'USDT',
    label: 'Tether (TRC20) — Recommended',
    prefixDesc: 'Address must start with capital "T"',
    fee: 1.5,
    minAmount: 15,
    eta: '1–2 hours',
    validate: (a: string) => a.startsWith('T') && a.length >= 33,
    samplePlaceholder: 'TYDzsYUEpvnYmQk4zGP9s2T7vLqNxVn8W9',
  },
  {
    id: 'USDT_ERC20',
    asset: 'USDT',
    label: 'Tether (ERC20)',
    prefixDesc: 'Address must start with "0x"',
    fee: 12.0,
    minAmount: 50,
    eta: '1–3 hours',
    validate: (a: string) => a.startsWith('0x') && a.length === 42,
    samplePlaceholder: '0x71C8364f3B3974E2397Bcb96d36e257B774eD8bE',
  },
  {
    id: 'USDT_BEP20',
    asset: 'USDT',
    label: 'Tether (BEP20)',
    prefixDesc: 'Address must start with "0x"',
    fee: 1.0,
    minAmount: 15,
    eta: '1–2 hours',
    validate: (a: string) => a.startsWith('0x') && a.length === 42,
    samplePlaceholder: '0x71C8364f3B3974E2397Bcb96d36e257B774eD8bE',
  },
  {
    id: 'BTC_MAINNET',
    asset: 'BTC',
    label: 'Bitcoin (BTC Native)',
    prefixDesc: 'Address should start with "bc1", "1", or "3"',
    fee: 15.0,
    minAmount: 50,
    eta: '1–4 hours',
    validate: (a: string) => (a.startsWith('bc1') || a.startsWith('1') || a.startsWith('3')) && a.length >= 26,
    samplePlaceholder: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  },
];

export default function WithdrawPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isWithdrawalBlocked = Boolean(user?.withdrawalsBlocked || user?.status === 'suspended');
  const { availableBalance, reservedTrading, reservedWithdrawal, requestCryptoWithdrawal } = useWalletStore();

  const [networkId, setNetworkId] = useState('USDT_TRC20');
  const [amount, setAmount] = useState('500');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);

  // 2FA Security Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedNet = NETWORKS.find(n => n.id === networkId) || NETWORKS[0];
  const numAmount = parseFloat(amount) || 0;
  const netPayable = Math.max(0, numAmount - selectedNet.fee);

  const handleAddressChange = (val: string) => {
    setDestinationAddress(val);
    if (!val.trim()) {
      setAddressError(null);
      return;
    }
    if (!selectedNet.validate(val.trim())) {
      setAddressError(selectedNet.prefixDesc);
    } else {
      setAddressError(null);
    }
  };

  const handleQuickPercent = (pct: number) => {
    const calculated = Math.floor(availableBalance * pct);
    setAmount(String(calculated));
  };

  const fillSampleAddress = () => {
    setDestinationAddress(selectedNet.samplePlaceholder);
    setAddressError(null);
  };

  const handleAuthorizeWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isWithdrawalBlocked) {
      alert('Withdrawals are restricted for this account by Compliance. Please contact Support.');
      return;
    }
    if (!authPin || authPin.length < 4) return;

    setIsProcessing(true);
    try {
      await requestCryptoWithdrawal({
        asset: selectedNet.asset,
        network: selectedNet.id,
        amount: numAmount,
        destinationAddress: destinationAddress.trim(),
      });
      setSubmitted(true);
      setShowConfirmModal(false);

      triggerFintechAlert({
        title: `Withdrawal Queued: -$${numAmount.toLocaleString()} USD`,
        message: `Requested payout of ${netPayable.toFixed(2)} ${selectedNet.asset} on ${selectedNet.label}.`,
        type: 'withdrawal',
        amount: numAmount,
        deepLink: '/wallet',
        actionText: 'View Ledger',
      });
    } catch {
      alert('Withdrawal request failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ maxWidth: 520 }}>
          <div className={styles.success}>
            <div className={styles.successIcon} style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'var(--brand-bot-500)' }}>
              <IconShieldCheck size={38} color="var(--brand-bot-500)" />
            </div>
            <h2 style={{ margin: '0 0 6px' }}>Withdrawal Queued</h2>
            <p className={styles.successAmt} style={{ color: 'var(--color-loss)', fontSize: 'var(--text-2xl)', margin: '0 0 12px', whiteSpace: 'nowrap' }}>
              -${numAmount.toLocaleString()} USD
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
                <span style={{ color: 'var(--text-muted)' }}>Security State:</span>
                <span style={{ color: 'var(--brand-bot-500)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IconClock size={12} /> Under Compliance Review
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Net Dispatched Amount:</span>
                <span style={{ color: 'var(--brand-mint-500)', fontWeight: 700 }}>
                  ${netPayable.toFixed(2)} ({selectedNet.asset})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Network Gas Deduction:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  -${selectedNet.fee.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Destination Wallet:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {destinationAddress.slice(0, 8)}...{destinationAddress.slice(-6)}
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              borderLeft: '3px solid var(--brand-bot-500)',
              borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              padding: '10px 12px',
              textAlign: 'left',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              marginBottom: 20,
            }}>
              Funds have been moved to your <strong>Reserved Balances</strong> and cannot be drawn or lost in trading. A compliance operator audits each on-chain dispatch from cold storage. Average dispatch time: 1–3 hours.
            </div>

            <button className={styles.btnPrimary} onClick={() => navigate('/wallet')}>
              Back to Wallet & Ledger
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate('/wallet')}>
            <IconArrowLeft size={16} />
            <span>Wallet</span>
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Withdraw Crypto</h2>
            <span style={{
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--brand-bot-500)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}>
              Manual Cold Storage Dispatch
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
            Submit an on-chain transfer to your external wallet. Dispatches are individually audited for account protection.
          </p>
        </div>

        {/* Compliance Withdrawal Restriction Warning Banner */}
        {isWithdrawalBlocked && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: 16,
            color: '#ff6b81',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, color: '#ff4d6d' }}>
              <IconAlertTriangle size={16} />
              <span>Withdrawals Suspended by Compliance</span>
            </div>
            <div>
              Withdrawal operations are temporarily disabled on your account by HKFES Risk & Compliance. If you require verification clearance or support, please open an inquiry ticket.
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('hkfes:open-support', { detail: { category: 'withdrawal', subject: 'Withdrawal Privileges Clearance' } }))}
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

        {/* Balance Overview Widget */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Available Cash</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-gain)', fontFamily: 'var(--font-mono)' }}>
              ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Locked in Trades</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              ${reservedTrading.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending Withdrawal</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--brand-bot-500)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              ${reservedWithdrawal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Destination Network Selector */}
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
            Destination Protocol Network
          </label>
          <select
            value={networkId}
            onChange={e => {
              setNetworkId(e.target.value);
              handleAddressChange(destinationAddress);
            }}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: '10px 12px',
              fontSize: 'var(--text-sm)',
              outline: 'none',
            }}
          >
            {NETWORKS.map(n => (
              <option key={n.id} value={n.id}>
                {n.label} — Gas Fee: ${n.fee} (Min: ${n.minAmount})
              </option>
            ))}
          </select>
        </div>

        {/* Amount Input with Quick Percents */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Withdrawal Amount (USD)
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Available: <strong>${availableBalance.toLocaleString()}</strong>
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '16px',
              fontFamily: 'var(--font-mono)'
            }}>
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: numAmount > availableBalance ? '1px solid var(--color-loss)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px 10px 28px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          {/* Quick Percentage Presets */}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {[
              { label: '25%', val: 0.25 },
              { label: '50%', val: 0.50 },
              { label: '75%', val: 0.75 },
              { label: 'MAX (100%)', val: 1.0 },
            ].map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleQuickPercent(p.val)}
                style={{
                  flex: 1,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {numAmount > availableBalance && (
            <div style={{ color: 'var(--color-loss)', fontSize: '11px', marginTop: 4 }}>
              Requested amount exceeds your unencumbered cash balance.
            </div>
          )}
        </div>

        {/* Destination Address Input */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Recipient External Wallet Address
            </label>
            <button
              type="button"
              onClick={fillSampleAddress}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-mint-500)',
                fontSize: '11px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Fill Sample Address
            </button>
          </div>

          <input
            type="text"
            placeholder={`Paste your ${selectedNet.label.split(' ')[0]} external address...`}
            value={destinationAddress}
            onChange={e => handleAddressChange(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: addressError ? '1px solid var(--color-warning)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '16px',
              outline: 'none',
            }}
          />

          {addressError && (
            <div style={{ color: 'var(--color-warning)', fontSize: '11px', marginTop: 4 }}>
              ⚠️ {addressError}
            </div>
          )}
        </div>

        {/* Calculation Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span>Network Mining Gas Surcharge</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>-${selectedNet.fee.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Net Receivable Amount
            </span>
            <span style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 800,
              color: 'var(--brand-mint-500)',
              fontFamily: 'var(--font-mono)'
            }}>
              ${netPayable.toFixed(2)} {selectedNet.asset}
            </span>
          </div>
        </div>

        {/* Review & Authorize Button */}
        <button
          className={styles.btnPrimary}
          disabled={
            isWithdrawalBlocked ||
            !numAmount ||
            numAmount < selectedNet.minAmount ||
            numAmount > availableBalance ||
            !destinationAddress ||
            !!addressError
          }
          onClick={() => {
            if (!isWithdrawalBlocked) setShowConfirmModal(true);
          }}
          style={{
            background: isWithdrawalBlocked ? 'var(--bg-elevated)' : 'var(--brand-mint-500)',
            color: isWithdrawalBlocked ? 'var(--text-muted)' : '#07090e',
            fontWeight: 800,
            cursor: isWithdrawalBlocked ? 'not-allowed' : 'pointer',
          }}
        >
          {isWithdrawalBlocked ? 'Withdrawals Disabled by Compliance' : 'Review & Authorize Withdrawal'}
        </button>

        {/* Security Confirmation Modal */}
        {showConfirmModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal)',
            padding: 'var(--space-4)',
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: 460,
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-modal)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <IconAlertTriangle size={24} color="var(--color-warning)" />
                <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                  Irreversible On-Chain Dispatch
                </h3>
              </div>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
                Blockchain transactions are permanent and cannot be modified or reversed once dispatched. Ensure your external destination address is 100% correct.
              </p>

              <div style={{
                background: 'var(--bg-input)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                wordBreak: 'break-all',
                color: 'var(--brand-mint-500)',
                marginBottom: 16,
              }}>
                {destinationAddress}
              </div>

              <form onSubmit={handleAuthorizeWithdrawal}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: 4 }}>
                    Enter Account Security PIN / 2FA Code (Demo: any 4+ digits e.g. 1234)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••"
                    value={authPin}
                    onChange={e => setAuthPin(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '20px',
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isProcessing}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || authPin.length < 4}
                    style={{
                      background: isProcessing || authPin.length < 4 ? 'var(--neutral-600)' : 'var(--brand-mint-500)',
                      color: '#07090e',
                      border: 'none',
                      fontWeight: 700,
                      padding: '8px 20px',
                      borderRadius: 'var(--radius-md)',
                      cursor: isProcessing || authPin.length < 4 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isProcessing ? 'Locking Funds...' : 'Authorize & Reserve'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}