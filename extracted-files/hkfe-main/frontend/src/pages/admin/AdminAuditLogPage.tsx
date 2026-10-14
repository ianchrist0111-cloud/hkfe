import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { IconArrowLeft, IconArrowRight } from '../../components/common/Icons';
import styles from './Admin.module.css';

interface AuditLogEntry {
  id: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  targetEntityType?: string;
  targetEntityId?: string;
  metadata?: string;
  createdAt: string;
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.adminGetAuditLogs(p, 25);
      if (res.success && res.data?.logs) {
        setLogs(res.data.logs);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const formatEventType = (type: string) => {
    switch (type) {
      case 'KYC_APPROVED':
        return { label: 'KYC Approved', badge: 'gain' };
      case 'KYC_REJECTED':
        return { label: 'KYC Rejected', badge: 'loss' };
      case 'ADMIN_USER_UPDATED':
        return { label: 'User Role/Status Modified', badge: 'gold' };
      case 'ADMIN_BALANCE_RESET':
        return { label: 'Paper Balance Adjusted', badge: 'medium' };
      case 'ADMIN_BULK_BALANCE_RESET':
        return { label: 'Bulk Wallet Reset', badge: 'loss' };
      case 'ADMIN_ENGINE_SPIKE':
        return { label: 'Volatility Spike Injected', badge: 'loss' };
      case 'ENGINE_LIVE_MARKET_SYNC':
        return { label: 'Live Exchange Tickers Calibrated', badge: 'gain' };
      case 'EMAIL_VERIFIED':
        return { label: 'Email Verified (OTP)', badge: 'gain' };
      case 'USER_REGISTERED':
        return { label: 'New User Registered', badge: 'gold' };
      case 'LOGIN_SUCCESS':
      case 'LOGIN_SUCCESS_MFA':
        return { label: 'User Authenticated', badge: 'gain' };
      case 'PASSWORD_RESET_COMPLETED':
        return { label: 'Password Reset Completed', badge: 'medium' };
      case 'INTERNAL_TRANSFER':
        return { label: 'Sub-Wallet Transfer', badge: 'gold' };
      case 'ORDER_FILLED':
        return { label: 'Order Execution Match', badge: 'gain' };
      case 'POSITION_CLOSED':
        return { label: 'TP/SL Position Liquidation', badge: 'medium' };
      default:
        return { label: type.replace(/_/g, ' '), badge: 'default' };
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Compliance & Security Audit Trail</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Immutable chronological ledger of all administrative risk actions, balance modifications, and volatility shocks.
          </p>
        </div>
        <button className={styles.btnCreate} onClick={() => fetchLogs(page)}>
          ↻ Refresh Logs
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading audit trail...
        </div>
      ) : logs.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          No audit logs recorded yet.
        </div>
      ) : (
        <div className={styles.table}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1.5fr 3fr',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--bg-elevated)',
            fontSize: '10px',
            fontWeight: 'var(--weight-semibold)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--text-muted)',
          }}>
            <span>Event Type</span>
            <span>Actor / Role</span>
            <span>Timestamp</span>
            <span>Target Entity / Metadata</span>
          </div>

          {logs.map(log => {
            const ev = formatEventType(log.eventType);
            return (
              <div
                key={log.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1.5fr 3fr',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <div>
                  <span className={`badge badge-${ev.badge}`} style={{ fontWeight: 600 }}>
                    {ev.label}
                  </span>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    {log.actorRole.toUpperCase()}
                  </strong>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {log.actorId.slice(0, 12)}…
                  </span>
                </div>

                <div className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {new Date(log.createdAt).toLocaleString()}
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {log.targetEntityType && (
                    <span style={{ fontWeight: 600, color: 'var(--accent-gold)', marginRight: 6 }}>
                      [{log.targetEntityType.toUpperCase()}]
                    </span>
                  )}
                  <span className="mono" style={{ color: 'var(--text-muted)' }}>
                    {log.metadata ? log.metadata : log.targetEntityId || 'System wide'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
          <button
            className={styles.filterBtn}
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconArrowLeft size={14} />
            <span>Previous</span>
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className={styles.filterBtn}
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>Next</span>
            <IconArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}