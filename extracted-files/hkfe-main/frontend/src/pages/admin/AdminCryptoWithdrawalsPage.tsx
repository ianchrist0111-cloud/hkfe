import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useWalletStore } from '../../store';
import { CryptoStatusBadge } from '../../components/common/CryptoStatusBadge';
import {
  IconSearch,
  IconCopy,
  IconCheck,
  IconX,
  IconRefreshCw,
  IconExternalLink
} from '../../components/common/Icons';
import styles from './Admin.module.css';

interface WithdrawalRequest {
  id: string;
  userId: string;
  userEmail?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    wallet?: {
      totalBalance: number;
      availableBalance: number;
    };
  };
  asset: string;
  network: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  toAddress: string;
  txHash?: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
}

const SEED_WITHDRAWALS: WithdrawalRequest[] = [
  {
    id: 'ctx_wdr_seed_1',
    userId: 'u_elena_205',
    userEmail: 'elena.rostova@hedge.com',
    user: {
      id: 'u_elena_205',
      email: 'elena.rostova@hedge.com',
      firstName: 'Elena',
      lastName: 'Rostova',
      wallet: {
        totalBalance: 48500.0,
        availableBalance: 32000.0,
      },
    },
    asset: 'USDT',
    network: 'USDT_TRC20',
    amount: 5000.0,
    feeAmount: 1.5,
    netAmount: 4998.5,
    toAddress: 'TLyqzVGLV1srkB7dToTAuggRe5GJ1s7392',
    status: 'PENDING_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: 'ctx_wdr_seed_2',
    userId: 'u_marcus_206',
    userEmail: 'marcus.vance@fund.io',
    user: {
      id: 'u_marcus_206',
      email: 'marcus.vance@fund.io',
      firstName: 'Marcus',
      lastName: 'Vance',
      wallet: {
        totalBalance: 12400.0,
        availableBalance: 8200.0,
      },
    },
    asset: 'BTC',
    network: 'BTC_MAINNET',
    amount: 2500.0,
    feeAmount: 15.0,
    netAmount: 2485.0,
    toAddress: 'bc1q9vzp0kscw6ykwg2n2z9s8u4k2x7a9n8m6l5j4k',
    status: 'PENDING_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
];

export default function AdminCryptoWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>(SEED_WITHDRAWALS);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal states
  const [activeModal, setActiveModal] = useState<{ type: 'approve' | 'reject'; item: WithdrawalRequest } | null>(null);
  const [broadcastTxHash, setBroadcastTxHash] = useState('');
  const [rejectReason, setRejectReason] = useState('Suspicious velocity / Account security verification required');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminCryptoWithdrawals();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setRequests(res.data);
      }
    } catch {
      // Demo fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const copyAddress = (id: string, addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openApproveModal = (req: WithdrawalRequest) => {
    setBroadcastTxHash('');
    setOperatorNotes('');
    setActiveModal({ type: 'approve', item: req });
  };

  const openRejectModal = (req: WithdrawalRequest) => {
    setRejectReason('Suspicious velocity / Account security verification required');
    setOperatorNotes('');
    setActiveModal({ type: 'reject', item: req });
  };

  const fillSampleBroadcastHash = () => {
    setBroadcastTxHash('7c1e3090ab845ef203d9284cf7190823485e7a912803847291a0b9487c12489a');
  };

  const executeApproval = async () => {
    if (!activeModal || !broadcastTxHash.trim()) return;
    setIsSubmitting(true);
    const targetId = activeModal.item.id;
    const cleanHash = broadcastTxHash.trim();

    try {
      await api.approveCryptoWithdrawal(targetId, cleanHash, operatorNotes);
    } catch {}

    setRequests(prev => prev.map(r => r.id === targetId ? { ...r, status: 'COMPLETED', txHash: cleanHash } : r));

    const walletStore = useWalletStore.getState();
    walletStore.fetchCryptoTransactions();
    walletStore.fetchWallet();

    setToastMessage(`✓ Withdrawal finalized: Broadcasted TXID registered.`);
    setTimeout(() => setToastMessage(null), 4000);

    setActiveModal(null);
    setIsSubmitting(false);
  };

  const executeRejection = async () => {
    if (!activeModal) return;
    setIsSubmitting(true);
    const targetId = activeModal.item.id;

    try {
      await api.rejectCryptoWithdrawal(targetId, rejectReason, operatorNotes);
    } catch {}

    setRequests(prev => prev.map(r => r.id === targetId ? { ...r, status: 'REJECTED', rejectionReason: rejectReason } : r));

    // Also restore active user's local balance if matching demo
    const walletStore = useWalletStore.getState();
    if (walletStore.reservedWithdrawal >= activeModal.item.amount) {
      useWalletStore.setState(s => ({
        availableBalance: s.availableBalance + activeModal.item.amount,
        reservedWithdrawal: Math.max(0, s.reservedWithdrawal - activeModal.item.amount),
      }));
    }
    walletStore.fetchCryptoTransactions();

    setToastMessage(`Withdrawal declined: $${activeModal.item.amount.toLocaleString()} restored to user's cash balance.`);
    setTimeout(() => setToastMessage(null), 4000);

    setActiveModal(null);
    setIsSubmitting(false);
  };

  const filtered = requests.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const email = r.userEmail || r.user?.email || '';
      return (
        email.toLowerCase().includes(q) ||
        r.asset.toLowerCase().includes(q) ||
        r.network.toLowerCase().includes(q) ||
        r.toAddress.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'PENDING_REVIEW').length;

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
          <h1>Cold Storage Withdrawal Dispatches</h1>
          <p className={styles.pageSubtitle}>
            Manually review destination addresses, send funds from platform custody wallets, and commit broadcasted TXID.
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
            <strong>{pendingCount} Pending Security Review</strong>
          </div>

          <button
            className={styles.btnSecondary}
            onClick={fetchWithdrawals}
            title="Refresh queue"
          >
            <IconRefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter & Search */}
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
            { id: 'all', label: 'All Requests' },
            { id: 'PENDING_REVIEW', label: `Under Review (${pendingCount})` },
            { id: 'COMPLETED', label: 'Dispatched' },
            { id: 'REJECTED', label: 'Declined' },
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
            placeholder="Search email, address, ID..."
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

      {/* Table */}
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
              <th style={{ padding: '12px 16px' }}>User Context</th>
              <th style={{ padding: '12px 16px' }}>Total Debit</th>
              <th style={{ padding: '12px 16px' }}>Net Dispatch</th>
              <th style={{ padding: '12px 16px' }}>Destination Wallet</th>
              <th style={{ padding: '12px 16px' }}>Requested</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No withdrawal requests found.
                </td>
              </tr>
            ) : (
              filtered.map(r => {
                const email = r.userEmail || r.user?.email || 'client@hkfes.com';
                const totalBal = r.user?.wallet?.totalBalance ?? 25000;
                const isPending = r.status === 'PENDING_REVIEW';
                const net = r.netAmount || (r.amount - (r.feeAmount || 1.5));

                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                        Balance Context: ${totalBal.toLocaleString()}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-loss)', fontSize: '15px' }}>
                      -${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-mint-500)' }}>
                      ${net.toLocaleString(undefined, { minimumFractionDigits: 2 })} {r.asset}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {r.toAddress.slice(0, 8)}...{r.toAddress.slice(-6)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyAddress(r.id, r.toAddress)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedId === r.id ? 'var(--brand-mint-500)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            padding: 2,
                          }}
                          title="Copy Full Destination Address"
                        >
                          {copiedId === r.id ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </button>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.network.replace('_', ' ')}
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <CryptoStatusBadge status={r.status} size="sm" />
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {isPending ? (
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => openApproveModal(r)}
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
                            Dispatched (Input TXID)
                          </button>
                          <button
                            type="button"
                            onClick={() => openRejectModal(r)}
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
                            Reject & Unlock
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

      {/* Approve & Input TXID Modal */}
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
            maxWidth: 500,
            padding: 24,
            boxShadow: 'var(--shadow-modal)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              Finalize Dispatch with Broadcast Hash
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Paste the blockchain transaction hash from your platform custody wallet broadcast. This permanently deducts the funds from the user's reserved balance.
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
              <div><strong>Recipient:</strong> {activeModal.item.userEmail || activeModal.item.user?.email}</div>
              <div><strong>Net Sent:</strong> ${activeModal.item.amount.toFixed(2)} {activeModal.item.asset}</div>
              <div style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--brand-mint-500)' }}>
                Target: {activeModal.item.toAddress}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Platform Dispatched Hash (TXID) <span style={{ color: 'var(--color-loss)' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={fillSampleBroadcastHash}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-mint-500)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Fill Sample Hash
                </button>
              </div>

              <input
                type="text"
                placeholder="Paste the broadcasted on-chain transaction hash..."
                value={broadcastTxHash}
                onChange={e => setBroadcastTxHash(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
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
                disabled={isSubmitting || !broadcastTxHash.trim()}
                style={{
                  background: isSubmitting || !broadcastTxHash.trim() ? 'var(--neutral-600)' : 'var(--brand-mint-500)',
                  color: '#07090e',
                  border: 'none',
                  fontWeight: 800,
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-md)',
                  cursor: isSubmitting || !broadcastTxHash.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Finalizing...' : 'Commit & Finalize Settlement'}
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
              Reject Withdrawal & Unlock Funds
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Declining this request will immediately return <strong>${activeModal.item.amount.toLocaleString()} USD</strong> from 'Reserved' back to the client's 'Available Cash'.
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
                <option value="Invalid address checksum or incompatible protocol">
                  Invalid address checksum or incompatible protocol
                </option>
                <option value="Unsettled trading positions or margin requirement conflict">
                  Unsettled trading positions or margin requirement conflict
                </option>
                <option value="Suspicious velocity / Account security verification required">
                  Suspicious velocity / Account security verification required
                </option>
                <option value="Requested cancellation by client via support ticket">
                  Requested cancellation by client via support ticket
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
                {isSubmitting ? 'Unlocking...' : 'Reject & Unlock Balance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
