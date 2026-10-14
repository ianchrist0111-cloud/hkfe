import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './Admin.module.css';
import {
  IconHeadphones,
  IconSend,
  IconClock,
  IconCheckCircle,
  IconSearch,
  IconUser,
  IconShieldCheck,
  IconAlertTriangle,
  IconTicket
} from '../../components/common/Icons';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  contactChannel: string;
  contactHandle?: string;
  assignedAdminId?: string;
  lastActivityAt: string;
  resolvedAt?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    kycStatus: string;
    role?: string;
    createdAt?: string;
  };
  messages: Array<{
    id: string;
    authorId?: string;
    authorRole: string;
    authorName?: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
  }>;
  _count?: { messages: number };
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ open: 0, inProgress: 0, awaitingUser: 0, resolved: 0, urgent: 0 });

  // Reply State
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replying, setReplying] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<{ password: string; emailed: boolean; email: string } | null>(null);
  const [issuingPassword, setIssuingPassword] = useState(false);

  const fetchTicketsAndStats = async () => {
    setLoading(true);
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        api.adminGetSupportTickets(statusFilter, searchQuery),
        api.adminGetSupportStats(),
      ]);

      if (ticketsRes.success && ticketsRes.data) {
        setTickets(ticketsRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Failed to load support tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsAndStats();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTicketsAndStats();
  };

  const handleSelectTicket = async (ticket: SupportTicket) => {
    setIssuedPassword(null);
    setLoadingDetail(true);
    try {
      const res = await api.adminGetSupportTicket(ticket.id);
      if (res.success && res.data) {
        setSelectedTicket(res.data);
      } else {
        setSelectedTicket(ticket);
      }
    } catch {
      setSelectedTicket(ticket);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleGeneratePassword = async () => {
    if (!selectedTicket) return;
    setIssuingPassword(true);
    setActionMsg(null);
    const res = await api.adminGeneratePassword(selectedTicket.userId);
    setIssuingPassword(false);
    if (res.success && res.data?.password) {
      setIssuedPassword({ password: res.data.password, emailed: Boolean(res.data.emailed), email: res.data.email });
      setActionMsg(res.data.message || 'Password generated.');
      const detailRes = await api.adminGetSupportTicket(selectedTicket.id);
      if (detailRes.success) setSelectedTicket(detailRes.data);
      fetchTicketsAndStats();
    } else {
      setActionMsg(res.error?.message || 'Could not generate a password.');
    }
    setTimeout(() => setActionMsg(null), 6000);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setReplying(true);
    setActionMsg(null);
    try {
      const res = await api.adminReplySupportTicket(selectedTicket.id, replyText.trim(), isInternalNote);
      if (res.success && res.data) {
        setReplyText('');
        setActionMsg(isInternalNote ? '✓ Internal note recorded' : '✓ Reply sent to client');
        // Refresh ticket details
        const detailRes = await api.adminGetSupportTicket(selectedTicket.id);
        if (detailRes.success && detailRes.data) {
          setSelectedTicket(detailRes.data);
        }
        // Refresh list
        fetchTicketsAndStats();
        setTimeout(() => setActionMsg(null), 3500);
      }
    } catch (err: any) {
      setActionMsg(`⚠️ Error: ${err.message}`);
    } finally {
      setReplying(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket) return;
    try {
      const res = await api.adminUpdateSupportTicket(selectedTicket.id, { status: newStatus });
      if (res.success && res.data) {
        setActionMsg(`✓ Ticket marked as ${newStatus.replace('_', ' ')}`);
        const detailRes = await api.adminGetSupportTicket(selectedTicket.id);
        if (detailRes.success && detailRes.data) {
          setSelectedTicket(detailRes.data);
        }
        fetchTicketsAndStats();
        setTimeout(() => setActionMsg(null), 3500);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!selectedTicket) return;
    try {
      const res = await api.adminUpdateSupportTicket(selectedTicket.id, { priority: newPriority });
      if (res.success && res.data) {
        const detailRes = await api.adminGetSupportTicket(selectedTicket.id);
        if (detailRes.success && detailRes.data) {
          setSelectedTicket(detailRes.data);
        }
        fetchTicketsAndStats();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Client Inquiries & Support Desk</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Review, prioritize, and reply to client inquiries, KYC questions, and funding assistance tickets.
          </p>
        </div>
        <button className={styles.btnCreate} onClick={fetchTicketsAndStats}>
          ↻ Refresh Inquiries
        </button>
      </div>

      {actionMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--color-gain)',
          color: 'var(--color-gain)',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}>
          {actionMsg}
        </div>
      )}

      {/* Metrics Row */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>📩</span>
            <span className={styles.statChange} style={{ color: stats.open > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
              {stats.open > 0 ? 'Needs Action' : 'Cleared'}
            </span>
          </div>
          <div className={styles.statValue} style={{ color: stats.open > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
            {stats.open}
          </div>
          <div className={styles.statLabel}>Open Inquiries</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>⚙️</span></div>
          <div className={styles.statValue} style={{ color: 'var(--accent-gold)' }}>
            {stats.inProgress}
          </div>
          <div className={styles.statLabel}>In Progress</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>⏳</span></div>
          <div className={styles.statValue} style={{ color: 'var(--brand-mint-500)' }}>
            {stats.awaitingUser}
          </div>
          <div className={styles.statLabel}>Awaiting Client</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}><span className={styles.statIcon}>🚨</span></div>
          <div className={styles.statValue} style={{ color: stats.urgent > 0 ? 'var(--color-loss)' : 'var(--text-muted)' }}>
            {stats.urgent}
          </div>
          <div className={styles.statLabel}>Urgent Priority</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.toolbar}>
        <div className={styles.filterBar}>
          {[
            { key: 'all', label: 'All Tickets' },
            { key: 'open', label: `Open (${stats.open})` },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'awaiting_user', label: 'Awaiting User' },
            { key: 'resolved', label: 'Resolved' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`${styles.filterBtn} ${statusFilter === tab.key ? styles.filterActive : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className={styles.searchBox} style={{ width: 280 }}>
          <IconSearch size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search ticket #, email, subject..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </form>
      </div>

      {/* Main Split Layout: Ticket List + Selected Ticket Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1.25fr' : '1fr', gap: '20px' }}>
        {/* Ticket List Table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 2fr 1fr 1fr',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-elevated)',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span>Ticket & User</span>
            <span>Subject / Preview</span>
            <span>Category</span>
            <span style={{ textAlign: 'right' }}>Status</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading inquiries...
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No inquiries found under this filter.
            </div>
          ) : (
            <div style={{ maxHeight: 620, overflowY: 'auto' }}>
              {tickets.map(t => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTicket(t)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 2fr 1fr 1fr',
                      gap: '12px',
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(0, 229, 153, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--brand-mint-500)' : '3px solid transparent',
                      cursor: 'pointer',
                      alignItems: 'center',
                      fontSize: '12px',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '13px' }}>
                        #{t.ticketNumber}
                      </strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                        {t.user.firstName ? `${t.user.firstName} ${t.user.lastName || ''}` : t.user.email}
                      </span>
                      {t.priority === 'urgent' && (
                        <span style={{ color: 'var(--color-loss)', fontSize: '10px', fontWeight: 700, display: 'block' }}>
                          ⚡ URGENT
                        </span>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.subject}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.messages?.[0]?.body || 'Inquiry created'}
                      </div>
                    </div>

                    <div>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}>
                        {t.category}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${t.status === 'resolved' ? 'badge-gain' : t.status === 'closed' ? 'badge-default' : 'badge-gold'}`} style={{ fontSize: '10px' }}>
                        {t.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Ticket Thread Panel */}
        {selectedTicket && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: 700,
          }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>
                    {selectedTicket.subject}
                  </h3>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--brand-mint-500)', fontWeight: 700 }}>
                    #{selectedTicket.ticketNumber}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Client: <strong>{selectedTicket.user.firstName} {selectedTicket.user.lastName}</strong> ({selectedTicket.user.email}) · KYC: <span style={{ color: selectedTicket.user.kycStatus === 'approved' ? 'var(--color-gain)' : 'var(--accent-gold)' }}>{selectedTicket.user.kycStatus.toUpperCase()}</span>
                </div>
                {selectedTicket.contactHandle && (
                  <div style={{ fontSize: '11px', color: '#29a9ea', marginTop: 2 }}>
                    Direct Handle: {selectedTicket.contactHandle} ({selectedTicket.contactChannel})
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={selectedTicket.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="awaiting_user">Awaiting Client</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  value={selectedTicket.priority}
                  onChange={e => handlePriorityChange(e.target.value)}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: selectedTicket.priority === 'urgent' ? 'var(--color-loss)' : 'var(--text-primary)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Conversation Messages */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 6 }}>
              {selectedTicket.messages?.map(m => {
                const isInternal = m.isInternal;
                const isUser = m.authorRole === 'user';
                const isSystem = m.authorRole === 'system';
                return (
                  <div
                    key={m.id}
                    style={{
                      background: isInternal
                        ? 'rgba(255, 183, 3, 0.1)'
                        : isUser
                        ? 'var(--bg-elevated)'
                        : isSystem
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(0, 229, 153, 0.1)',
                      border: isInternal
                        ? '1px dashed var(--accent-gold)'
                        : '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: '12px',
                      maxWidth: '92%',
                      alignSelf: isUser ? 'flex-start' : isInternal ? 'center' : 'flex-end',
                      width: isInternal ? '100%' : 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
                      <strong style={{
                        color: isInternal ? 'var(--accent-gold)' : isUser ? 'var(--text-primary)' : 'var(--brand-mint-500)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {isInternal ? '🔒 Internal Note (Admin Only)' : m.authorName || (isUser ? 'Client' : 'Admin')}
                      </strong>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                      {m.body}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedTicket.subject === 'Password reset requested' && selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
              <div style={{
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <strong style={{ fontSize: '13px' }}>Reset this client's password</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Generate a new password and email it to {selectedTicket.user.email}.
                </span>
                <button type="button" className={styles.btnPrimary} onClick={handleGeneratePassword} disabled={issuingPassword} style={{ width: 'fit-content' }}>
                  {issuingPassword ? 'Generating...' : 'Generate and send to client'}
                </button>
              </div>
            )}
            {issuedPassword && (
              <div style={{
                border: '1px solid var(--brand-mint-500)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {issuedPassword.emailed
                    ? `Emailed to ${issuedPassword.email}. You can also copy it.`
                    : `Email to ${issuedPassword.email} was not delivered. Copy this password and send it to the client.`}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: '16px', fontWeight: 800 }}>{issuedPassword.password}</code>
                  <button type="button" className={styles.btnSecondary} onClick={() => navigator.clipboard.writeText(issuedPassword.password)}>
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Reply Composer */}
            <form onSubmit={handleSendReply} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {isInternalNote ? 'Add Internal Note (visible only to admin team):' : 'Reply to Client (client receives in-app alert):'}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', cursor: 'pointer', color: isInternalNote ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={e => setIsInternalNote(e.target.checked)}
                  />
                  <span>Internal Admin Note</span>
                </label>
              </div>

              <textarea
                style={{
                  width: '100%',
                  background: isInternalNote ? 'rgba(255, 183, 3, 0.05)' : 'var(--bg-input)',
                  border: isInternalNote ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  minHeight: 70,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                placeholder={isInternalNote ? 'Type an internal note regarding this client or verification...' : 'Type response to client...'}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={replying || !replyText.trim()}
                  style={{
                    background: isInternalNote ? 'var(--accent-gold)' : 'var(--brand-mint-500)',
                    color: '#07090e',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: replying || !replyText.trim() ? 0.5 : 1,
                  }}
                >
                  <IconSend size={14} />
                  <span>{replying ? 'Sending...' : isInternalNote ? 'Save Internal Note' : 'Send Reply to Client'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
