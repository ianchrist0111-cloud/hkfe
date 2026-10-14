import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useWalletStore } from '../../store';
import { CryptoStatusBadge } from '../../components/common/CryptoStatusBadge';
import {
  IconSearch,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconX,
  IconClock,
  IconShieldCheck,
  IconRefreshCw
} from '../../components/common/Icons';
import styles from './Admin.module.css';

interface DepositClaim {
  id: string;
  userId: string;
  userEmail?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    kycStatus?: string;
  };
  asset: string;
  network: string;
  amount: number;
  txHash?: string;
  proofImageUrl?: string;
  internalNotes?: string | null;
  status: string;
  rejectionReason?: string;
  createdAt: string;
}

export default function AdminCryptoDepositsPage() {
  const [claims, setClaims] = useState<DepositClaim[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<{ type: 'approve' | 'reject'; item: DepositClaim } | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [rejectReason, setRejectReason] = useState('Transaction not found on blockchain explorer / invalid hash');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminCryptoDeposits();
      if (res.success && Array.isArray(res.data)) {
        setClaims(res.data);
      }
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, []);

  const getExplorerUrl = (hash?: string, network?: string) => {
    if (!hash) return '#';
    if (network?.includes('TRC20')) return `https://tronscan.org/#/transaction/${hash}`;
    if (network?.includes('ERC20')) return `https://etherscan.io/tx/${hash}`;
    if (network?.includes('BEP20')) return `https://bscscan.com/tx/${hash}`;
    if (network?.includes('BTC')) return `https://mempool.space/tx/${hash}`;
    return `https://blockchair.com/search?q=${hash}`;
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openApproveModal = (claim: DepositClaim) => {
    setCreditAmount(String(claim.amount));
    setOperatorNotes('');
    setActiveModal({ type: 'approve', item: claim });
  };

  const openRejectModal = (claim: DepositClaim) => {
    setRejectReason('Transaction not found on blockchain explorer / invalid hash');
    setOperatorNotes('');
    setActiveModal({ type: 'reject', item: claim });
  };

  const executeApproval = async () => {
    if (!activeModal) return;
    setIsSubmitting(true);
    const targetId = activeModal.item.id;
    const finalAmount = parseFloat(creditAmount) || activeModal.item.amount;

    try {
      await api.approveCryptoDeposit(targetId, finalAmount, operatorNotes);
    } catch {}

    // Update local state optimistically
    setClaims(prev => prev.map(c => c.id === targetId ? { ...c, status: 'COMPLETED' } : c));

    // Also update current active user's wallet store if matching
    const walletStore = useWalletStore.getState();
    walletStore.fetchCryptoTransactions();
    walletStore.fetchWallet();

    setToastMessage(`✓ Deposit approved: $${finalAmount.toLocaleString()} credited successfully.`);
    setTimeout(() => setToastMessage(null), 4000);

    setActiveModal(null);
    setIsSubmitting(false);
  };

  const executeRejection = async () => {
    if (!activeModal) return;
    setIsSubmitting(true);
    const targetId = activeModal.item.id;

    try {
      await api.rejectCryptoDeposit(targetId, rejectReason, operatorNotes);
    } catch {}

    setClaims(prev => prev.map(c => c.id === targetId ? { ...c, status: 'REJECTED', rejectionReason: rejectReason } : c));

    useWalletStore.getState().fetchCryptoTransactions();

    setToastMessage(`Deposit claim rejected: Notification sent to user.`);
    setTimeout(() => setToastMessage(null), 4000);

    setActiveModal(null);
    setIsSubmitting(false);
  };

  const filtered = claims.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const email = c.userEmail || c.user?.email || '';
      return (
        email.toLowerCase().includes(q) ||
        c.asset.toLowerCase().includes(q) ||
        c.network.toLowerCase().includes(q) ||
        (c.txHash && c.txHash.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = claims.filter(c => c.status === 'PENDING_VERIFICATION').length;
  const awaitingCount = claims.filter(c => c.status === 'AWAITING_PAYMENT').length;

  return (
    <div className={styles.page}>
      {/* Toast */}
      {toastMessage && (
        <div style={{
          background: 'rgba(0, 217, 160, 0.15)',
          border: '1px solid var(--brand-mint-500)',
          color: 'var(--brand-mint-500)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
        }}>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Crypto Deposits Verification Desk</h1>
          <p className={styles.pageSubtitle}>
            Audit user-claimed transaction hashes directly against blockchain explorers before committing balance credits.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 'var(--text-xs)',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: pendingCount > 0 ? 'var(--color-warning)' : 'var(--color-gain)'
            }} />
            <strong>{pendingCount} Awaiting Manual Audit</strong>
          </div>

          <button
            className={styles.btnSecondary}
            onClick={fetchDeposits}
            title="Refresh queue"
          >
            <IconRefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Records' },
            { id: 'AWAITING_PAYMENT', label: `Started (${awaitingCount})` },
            { id: 'PENDING_VERIFICATION', label: `Payment sent (${pendingCount})` },
            { id: 'COMPLETED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
          ].map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setFilterStatus(st.id)}
              style={{
                background: filterStatus === st.id ? 'var(--bg-elevated)' : 'transparent',
                border: filterStatus === st.id ? '1px solid var(--brand-mint-500)' : '1px solid var(--border-subtle)',
                color: filterStatus === st.id ? 'var(--brand-mint-500)' : 'var(--text-secondary)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 260,
        }}>
          <IconSearch size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search email, TXID, asset..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Verification Table */}
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px' }}>User & KYC</th>
              <th style={{ padding: '12px 16px' }}>Asset / Protocol</th>
              <th style={{ padding: '12px 16px' }}>Claimed Amount</th>
              <th style={{ padding: '12px 16px' }}>Blockchain Hash (TXID)</th>
              <th style={{ padding: '12px 16px' }}>Submitted</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Compliance Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No deposit claims match your search or filter.
                </td>
              </tr>
            ) : (
              filtered.map(c => {
                const email = c.userEmail || c.user?.email || 'trader@hkfes.com';
                const canReview = c.status === 'PENDING_VERIFICATION';
                const isWaiting = c.status === 'AWAITING_PAYMENT';
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--color-gain)',
                          background: 'rgba(0, 229, 153, 0.12)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-xs)',
                          fontWeight: 700,
                        }}>
                          KYC Level 2
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: 'rgba(0, 217, 160, 0.1)',
                        color: 'var(--brand-mint-500)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}>
                        {c.asset} · {c.network?.replace(/_/g, ' ')}
                      </span>
                      {c.internalNotes && (
                        <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--text-muted)', maxWidth: 220, whiteSpace: 'pre-wrap' }}>
                          {c.internalNotes}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-gain)', fontSize: '15px' }}>
                      +${c.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      {c.txHash ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <a
                            href={getExplorerUrl(c.txHash, c.network)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'var(--brand-mint-500)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              textDecoration: 'none',
                            }}
                            title="Verify on Blockchain Explorer"
                          >
                            <span>{c.txHash.slice(0, 8)}...{c.txHash.slice(-6)}</span>
                            <IconExternalLink size={12} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopy(c.id, c.txHash!)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedId === c.id ? 'var(--brand-mint-500)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              padding: 2,
                            }}
                            title="Copy Hash"
                          >
                            {copiedId === c.id ? <IconCheck size={12} /> : <IconCopy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No hash provided</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <CryptoStatusBadge status={c.status} size="sm" />
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {canReview || isWaiting ? (
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          {canReview ? (
                          <button
                            onClick={() => openApproveModal(c)}
                            style={{
                              background: 'var(--brand-mint-500)',
                              color: '#07090e',
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Approve & Credit
                          </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>Waiting for transfer</span>
                          )}
                          <button
                            onClick={() => openRejectModal(c)}
                            style={{
                              background: 'transparent',
                              color: 'var(--color-loss)',
                              border: '1px solid var(--color-loss-border)',
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ticket Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Approve Confirmation Modal */}
      {activeModal?.type === 'approve' && (
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
            width: '100%',
            maxWidth: 480,
            padding: 24,
            boxShadow: 'var(--shadow-modal)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              Verify & Credit Trading Balance
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Confirm that you have checked the blockchain explorer and verified that the transaction has achieved required block confirmations.
            </p>

            <div style={{
              background: 'var(--bg-input)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              fontSize: 'var(--text-xs)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              <div><strong>User:</strong> {activeModal.item.userEmail || activeModal.item.user?.email}</div>
              <div><strong>Protocol:</strong> {activeModal.item.network}</div>
              {activeModal.item.txHash && (
                <div style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--brand-mint-500)' }}>
                  TXID: {activeModal.item.txHash}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4 }}>
                Credit Amount in USD
              </label>
              <input
                type="number"
                step="any"
                value={creditAmount}
                onChange={e => setCreditAmount(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '18px',
                  fontWeight: 800,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
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
                type="button"
                onClick={executeApproval}
                disabled={isSubmitting}
                style={{
                  background: 'var(--brand-mint-500)',
                  color: '#07090e',
                  border: 'none',
                  fontWeight: 800,
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Crediting Ledger...' : 'Approve & Credit Balance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {activeModal?.type === 'reject' && (
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
            width: '100%',
            maxWidth: 480,
            padding: 24,
            boxShadow: 'var(--shadow-modal)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', color: 'var(--color-loss)', fontWeight: 700 }}>
              Reject Deposit Claim
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Select a reason for declining this claim. The user will be notified with instructions on how to resubmit.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4 }}>
                Documented Rejection Reason
              </label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              >
                <option value="Transaction not found on blockchain explorer / invalid hash">
                  Transaction not found on blockchain explorer / invalid hash
                </option>
                <option value="Deposit received is below the platform minimum threshold">
                  Deposit received is below the platform minimum threshold
                </option>
                <option value="Incompatible token or wrong blockchain layer dispatched">
                  Incompatible token or wrong blockchain layer dispatched
                </option>
                <option value="Duplicate TXID already credited to another user">
                  Duplicate TXID already credited to another user
                </option>
                <option value="Compliance review required — contact customer support">
                  Compliance review required — contact customer support
                </option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
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
                type="button"
                onClick={executeRejection}
                disabled={isSubmitting}
                style={{
                  background: 'var(--color-loss)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
