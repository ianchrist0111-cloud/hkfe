import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './Admin.module.css';

interface KycApplicant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  kycStatus: string;
  queueStatus?: string;
  createdAt: string;
  wallet?: { totalBalance: number };
  kycRecord?: {
    caseReference?: string;
    documentType?: string;
    documentNumber?: string;
    documentRef?: string;
    documentBackRef?: string;
    selfieRef?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    country?: string;
    nationality?: string;
    occupation?: string;
    sourceOfFunds?: string;
    submittedAt?: string;
    reviewedAt?: string;
    notes?: string;
  } | null;
}

export default function AdminKycPage() {
  const [users, setUsers] = useState<KycApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'rejected' | 'approved'>('pending');
  const [rejectModalUser, setRejectModalUser] = useState<KycApplicant | null>(null);
  const [viewDocUser, setViewDocUser] = useState<KycApplicant | null>(null);
  const [activeDocTab, setActiveDocTab] = useState<'front' | 'back' | 'selfie'>('front');
  const [rejectReason, setRejectReason] = useState('Document image blurry and illegible. Please re-upload a clear government ID.');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.adminGetKycQueue(filter);
      if (res.success && res.data?.applicants) {
        setUsers(res.data.applicants);
      }
    } catch (err) {
      console.error('Failed to fetch KYC queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const handleApprove = async (user: KycApplicant) => {
    try {
      const res = await api.adminReviewKyc(user.id, 'approved');
      if (res.success) {
        setActionSuccess(`✓ KYC approved for ${user.firstName} ${user.lastName}`);
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, kycStatus: 'approved' } : u));
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalUser) return;
    try {
      const res = await api.adminReviewKyc(rejectModalUser.id, 'rejected', rejectReason);
      if (res.success) {
        setActionSuccess(`✗ KYC rejected for ${rejectModalUser.firstName} ${rejectModalUser.lastName}`);
        setUsers(prev => prev.map(u => u.id === rejectModalUser.id ? { ...u, kycStatus: 'rejected' } : u));
        setRejectModalUser(null);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = users.filter(u => {
    if (filter === 'all') return true;
    return u.kycStatus === filter;
  });

  const pendingCount = users.filter(u => u.kycStatus === 'pending').length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>KYC Verification Queue</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Review submitted government ID documents and manage applicant verification status.
          </p>
        </div>
        <button className={styles.btnCreate} onClick={fetchUsers}>
          ↻ Refresh Queue
        </button>
      </div>

      {actionSuccess && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--color-gain)',
          color: 'var(--color-gain)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}>
          {actionSuccess}
        </div>
      )}

      {/* Metric Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>⏳</span>
            <span className={styles.statChange} style={{ color: pendingCount > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
              {pendingCount > 0 ? 'Action Required' : 'Up to date'}
            </span>
          </div>
          <div className={styles.statValue} style={{ color: pendingCount > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
            {pendingCount}
          </div>
          <div className={styles.statLabel}>Pending Review</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>✅</span></div>
          <div className={styles.statValue} style={{ color: 'var(--color-gain)' }}>
            {users.filter(u => u.kycStatus === 'approved').length}
          </div>
          <div className={styles.statLabel}>Verified Traders</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>❌</span></div>
          <div className={styles.statValue} style={{ color: 'var(--color-loss)' }}>
            {users.filter(u => u.kycStatus === 'rejected').length}
          </div>
          <div className={styles.statLabel}>Rejected Applications</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>📋</span></div>
          <div className={styles.statValue}>{users.length}</div>
          <div className={styles.statLabel}>Total Platform Profiles</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.toolbar}>
        <div className={styles.filterBar}>
          {(['pending', 'all', 'approved', 'rejected'] as const).map(tab => (
            <button
              key={tab}
              className={`${styles.filterBtn} ${filter === tab ? styles.filterActive : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab === 'pending' ? `⏳ Pending Review (${pendingCount})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KYC Submissions Table */}
      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading KYC applicants...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          No applicants found under "{filter}".
        </div>
      ) : (
        <div className={styles.table}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 2fr',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--bg-elevated)',
            fontSize: '10px',
            fontWeight: 'var(--weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--text-muted)',
          }}>
            <span>Applicant</span>
            <span>Document Details</span>
            <span>Location / Address</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Compliance Action</span>
          </div>

          {filtered.map(user => {
            const kyc = user.kycRecord;
            return (
              <div
                key={user.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 2fr',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {/* Applicant Info */}
                <div className={styles.userCell}>
                  <div className={styles.userAvatar}>
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div>
                    <strong>{user.firstName} {user.lastName}</strong>
                    <p>{user.email}</p>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Registered: {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Document Info */}
                <div>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                    📄 {kyc?.documentType ? kyc.documentType.replace('_', ' ') : 'Government ID'}
                    {kyc?.caseReference && (
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--brand-mint-500)', marginLeft: 6, fontWeight: 700 }}>
                        [{kyc.caseReference}]
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--accent-gold)' }}>
                      {kyc?.documentNumber ? `ID: ${kyc.documentNumber}` : (kyc?.documentRef?.startsWith('data:') ? 'base64-doc' : (kyc?.documentRef || 'doc-ref-pending.jpg'))}
                    </span>
                    <button
                      type="button"
                      style={{
                        background: 'rgba(0, 229, 153, 0.1)',
                        border: '1px solid rgba(0, 229, 153, 0.3)',
                        color: 'var(--brand-mint-500)',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setViewDocUser(user)}
                    >
                      👁 View ID
                    </button>
                  </div>
                  {kyc?.notes && (
                    <p style={{ fontSize: '11px', color: 'var(--color-loss)', margin: '2px 0 0 0' }}>
                      Note: {kyc.notes}
                    </p>
                  )}
                </div>


                {/* Address */}
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <div>{kyc?.addressLine1 || '100 Financial Way'}</div>
                  <div>{kyc?.city || 'New York'}, {kyc?.country || 'US'}</div>
                </div>

                {/* Status Badge */}
                <div>
                  <span className={`badge badge-${
                    user.kycStatus === 'approved' ? 'gain' : user.kycStatus === 'pending' ? 'medium' : user.kycStatus === 'not_started' ? 'default' : 'loss'
                  }`}>
                    {user.kycStatus.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  {user.kycStatus !== 'approved' && (
                    <button
                      className={styles.actionBtn}
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        borderColor: 'var(--color-gain)',
                        color: 'var(--color-gain)',
                        fontWeight: 600,
                      }}
                      onClick={() => handleApprove(user)}
                    >
                      ✓ Approve
                    </button>
                  )}
                  {user.kycStatus !== 'rejected' && (
                    <button
                      className={styles.actionBtn}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        borderColor: 'var(--color-loss)',
                        color: 'var(--color-loss)',
                        fontWeight: 600,
                      }}
                      onClick={() => {
                        setRejectModalUser(user);
                      }}
                    >
                      ✗ Reject
                    </button>
                  )}
                  {user.kycStatus === 'approved' && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gain)', fontWeight: 600 }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: 'var(--space-4)',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '480px',
            padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-modal)',
          }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginBottom: 8, color: 'var(--color-loss)' }}>
              Reject KYC Submission
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Provide the compliance rejection reason for <strong>{rejectModalUser.firstName} {rejectModalUser.lastName}</strong> ({rejectModalUser.email}).
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
                Preset Reason:
              </label>
              <select
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  fontSize: 'var(--text-sm)',
                  marginBottom: 10,
                  outline: 'none',
                }}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option value="Document image blurry and illegible. Please re-upload a clear government ID.">
                  Document image blurry / illegible
                </option>
                <option value="Identification document has expired. Please submit a valid passport or license.">
                  Document expired
                </option>
                <option value="Name on uploaded ID does not match registered account name.">
                  Name mismatch on ID
                </option>
                <option value="Proof of address older than 90 days. Please provide recent utility bill.">
                  Proof of address too old (&gt; 90 days)
                </option>
              </select>

              <textarea
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  fontSize: 'var(--text-sm)',
                  minHeight: '80px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  resize: 'vertical',
                }}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className={styles.actionBtn}
                onClick={() => setRejectModalUser(null)}
              >
                Cancel
              </button>
              <button
                className={styles.actionBtn}
                style={{
                  background: 'var(--color-loss)',
                  color: '#fff',
                  borderColor: 'var(--color-loss)',
                  fontWeight: 600,
                }}
                onClick={handleRejectConfirm}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Inspector Modal */}
      {viewDocUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--space-4)',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            width: '100%',
            maxWidth: '540px',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                  KYC Document Inspector
                </h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Applicant: {viewDocUser.firstName} {viewDocUser.lastName} ({viewDocUser.email})
                </span>
              </div>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
                onClick={() => setViewDocUser(null)}
              >
                ✕
              </button>
            </div>

            {/* Tabs for Front, Back, and Selfie */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setActiveDocTab('front')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: activeDocTab === 'front' ? 'var(--brand-mint-500)' : 'var(--bg-elevated)',
                  color: activeDocTab === 'front' ? '#000' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                1. Front Document
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('back')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: activeDocTab === 'back' ? 'var(--brand-mint-500)' : 'var(--bg-elevated)',
                  color: activeDocTab === 'back' ? '#000' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                2. Back Document
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('selfie')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: activeDocTab === 'selfie' ? 'var(--brand-mint-500)' : 'var(--bg-elevated)',
                  color: activeDocTab === 'selfie' ? '#000' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                3. Liveness Selfie
              </button>
            </div>

            {/* Document Preview Box */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '220px',
              marginBottom: 'var(--space-4)',
            }}>
              {(() => {
                const currentDoc =
                  activeDocTab === 'front'
                    ? viewDocUser.kycRecord?.documentRef
                    : activeDocTab === 'back'
                    ? viewDocUser.kycRecord?.documentBackRef
                    : viewDocUser.kycRecord?.selfieRef;

                if (currentDoc?.startsWith('data:image/')) {
                  return (
                    <img
                      src={currentDoc}
                      alt={activeDocTab}
                      style={{
                        maxHeight: '280px',
                        maxWidth: '100%',
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'contain',
                        border: '1px solid var(--border-subtle)',
                      }}
                    />
                  );
                }

                return (
                  <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>
                      {activeDocTab === 'selfie' ? '🤳' : '🪪'}
                    </div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 4 }}>
                      {activeDocTab.toUpperCase()} {activeDocTab === 'selfie' ? 'LIVENESS VERIFICATION' : 'IMAGE FILE'}
                    </strong>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--accent-gold)' }}>
                      REF: {currentDoc || 'document-verified-sample.jpg'}
                    </span>
                    <div style={{
                      marginTop: 12,
                      fontSize: '11px',
                      color: 'var(--brand-mint-500)',
                      background: 'rgba(0, 229, 153, 0.1)',
                      border: '1px solid rgba(0, 229, 153, 0.2)',
                      borderRadius: 4,
                      padding: '4px 10px',
                      display: 'inline-block',
                    }}>
                      ✓ Institutional Anti-Spoofing & Liveness Passed
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Applicant Details Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              fontSize: '12px',
              marginBottom: 'var(--space-5)',
              padding: '10px 12px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Document Type:</span>
                <strong style={{ display: 'block', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {viewDocUser.kycRecord?.documentType?.replace('_', ' ') || 'Passport'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <strong style={{ display: 'block', color: viewDocUser.kycStatus === 'approved' ? 'var(--color-gain)' : 'var(--accent-gold)' }}>
                  {viewDocUser.kycStatus.toUpperCase()}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Jurisdiction:</span>
                <span style={{ display: 'block', color: 'var(--text-primary)' }}>
                  {viewDocUser.kycRecord?.country || 'US'} - {viewDocUser.kycRecord?.state || 'NY'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Address:</span>
                <span style={{ display: 'block', color: 'var(--text-primary)' }}>
                  {viewDocUser.kycRecord?.addressLine1 || '100 Financial Way'}
                </span>
              </div>
            </div>

            {/* Inspector Decision Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className={styles.actionBtn}
                onClick={() => setViewDocUser(null)}
              >
                Close
              </button>
              {viewDocUser.kycStatus !== 'rejected' && (
                <button
                  className={styles.actionBtn}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'var(--color-loss)',
                    color: 'var(--color-loss)',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    const u = viewDocUser;
                    setViewDocUser(null);
                    setRejectModalUser(u);
                  }}
                >
                  ✗ Reject ID
                </button>
              )}
              {viewDocUser.kycStatus !== 'approved' && (
                <button
                  className={styles.actionBtn}
                  style={{
                    background: 'var(--color-gain)',
                    borderColor: 'var(--color-gain)',
                    color: '#000',
                    fontWeight: 700,
                  }}
                  onClick={async () => {
                    await handleApprove(viewDocUser);
                    setViewDocUser(null);
                  }}
                >
                  ✓ Approve KYC
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

