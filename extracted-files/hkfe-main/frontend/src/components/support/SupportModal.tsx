import React, { useState, useEffect } from 'react';
import styles from './SupportModal.module.css';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  IconHeadphones,
  IconSend,
  IconTelegram,
  IconTicket,
  IconX,
  IconCheckCircle,
  IconCopy,
  IconExternalLink,
  IconArrowLeft,
  IconClock,
  IconShieldCheck,
  IconCheck,
} from '../common/Icons';

export interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'choice' | 'ticket' | 'telegram' | 'list';
  initialCategory?: string;
  initialSubject?: string;
  initialMessage?: string;
}

const CATEGORIES = [
  { value: 'kyc', label: 'KYC & Identity Verification' },
  { value: 'deposit', label: 'Deposit & Crypto Funding' },
  { value: 'withdrawal', label: 'Withdrawal Request' },
  { value: 'trading', label: 'Order Execution & Trading' },
  { value: 'account', label: 'Account & Security (MFA / Login)' },
  { value: 'technical', label: 'Technical Bug / UI Glitch' },
  { value: 'other', label: 'General Compliance & Support' },
];

export default function SupportModal({
  isOpen,
  onClose,
  initialMode = 'choice',
  initialCategory = 'account',
  initialSubject = '',
  initialMessage = '',
}: SupportModalProps) {
  const user = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState<'create' | 'telegram' | 'list'>(
    initialMode === 'telegram' ? 'telegram' : initialMode === 'list' ? 'list' : 'create'
  );

  // Form State
  const [category, setCategory] = useState(initialCategory);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [contactChannel, setContactChannel] = useState<'in_app' | 'email' | 'telegram'>('in_app');
  const [contactHandle, setContactHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<any | null>(null);

  // My Tickets List
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // Copy toast
  const [copiedHandle, setCopiedHandle] = useState(false);

  // Platform Config (Dynamic Telegram visibility & handle)
  const [platformConfig, setPlatformConfig] = useState<{
    telegramEnabled: boolean;
    telegramHandle: string;
    telegramNumber: string;
    telegramUrl: string;
  }>({
    telegramEnabled: false,
    telegramHandle: '',
    telegramNumber: '',
    telegramUrl: '',
  });

  useEffect(() => {
    let isMounted = true;
    api.getPlatformConfig().then(res => {
      if (isMounted && res.success && res.data) {
        setPlatformConfig({
          telegramEnabled: Boolean(res.data.telegramEnabled),
          telegramHandle: res.data.telegramHandle || '',
          telegramNumber: res.data.telegramNumber || '',
          telegramUrl: res.data.telegramUrl || '',
        });
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [isOpen]);

  const telegramUrl = platformConfig.telegramUrl || (platformConfig.telegramHandle ? `https://t.me/${platformConfig.telegramHandle.replace(/^@/, '')}` : 'https://t.me/hkfes_support');
  const telegramHandle = platformConfig.telegramHandle ? (platformConfig.telegramHandle.startsWith('@') ? platformConfig.telegramHandle : `@${platformConfig.telegramHandle}`) : (platformConfig.telegramNumber || '@hkfes_support');

  // Sync props when modal opens or initialCategory/Subject changes
  useEffect(() => {
    if (isOpen) {
      if (initialCategory) setCategory(initialCategory);
      if (initialSubject) setSubject(initialSubject);
      if (initialMessage) setMessage(initialMessage);
      if (initialMode === 'telegram' && platformConfig.telegramEnabled) setActiveTab('telegram');
      else if (initialMode === 'list') setActiveTab('list');
      else setActiveTab('create');
      setSubmitError(null);
      setCreatedTicket(null);
    }
  }, [isOpen, initialCategory, initialSubject, initialMessage, initialMode, platformConfig.telegramEnabled]);

  // Fetch tickets when opening "list" tab
  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await api.getSupportTickets();
      if (res.success && res.data) {
        setTickets(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'list' && isOpen) {
      fetchTickets();
    }
  }, [activeTab, isOpen]);

  const loadTicketDetail = async (ticketId: string) => {
    try {
      const res = await api.getSupportTicket(ticketId);
      if (res.success && res.data) {
        setSelectedTicket(res.data);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!subject.trim()) {
      setSubmitError('Please enter a brief subject for your inquiry.');
      return;
    }
    if (message.trim().length < 10) {
      setSubmitError('Please provide more details regarding your inquiry (minimum 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createSupportTicket({
        category,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        contactChannel,
        contactHandle: contactHandle.trim() || undefined,
      });

      if (res.success && res.data) {
        setCreatedTicket(res.data);
        // Reset form
        setSubject('');
        setMessage('');
        setContactHandle('');
      } else {
        setSubmitError(res.error?.message || 'Failed to submit support ticket. Please try again.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Network error submitting support request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setReplying(true);
    try {
      const res = await api.replySupportTicket(selectedTicket.id, replyText.trim());
      if (res.success && res.data) {
        setReplyText('');
        // Refresh ticket
        await loadTicketDetail(selectedTicket.id);
      }
    } catch {
      // ignore
    } finally {
      setReplying(false);
    }
  };

  const handleCopyTelegram = () => {
    navigator.clipboard?.writeText(telegramHandle);
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrap}>
              <IconHeadphones size={20} />
            </div>
            <div>
              <h2 className={styles.headerTitle}>HKFES Client Support Desk</h2>
              <p className={styles.headerSub}>24/7 Institutional Trading & Compliance Assistance</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <IconX size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Top Choice Cards */}
          <div className={styles.choiceCards} style={!platformConfig.telegramEnabled ? { gridTemplateColumns: '1fr' } : undefined}>
            {/* Choice 1: Form Submission */}
            <div
              className={`${styles.choiceCard} ${activeTab === 'create' ? styles.choiceCardActive : ''}`}
              onClick={() => {
                setActiveTab('create');
                setSelectedTicket(null);
                setCreatedTicket(null);
              }}
            >
              <div className={styles.choiceCardTop}>
                <div className={styles.choiceIconBadge}>
                  <IconTicket size={18} />
                </div>
                <span className={`${styles.choiceTag} ${styles.choiceTagFast}`}>Official Ticket</span>
              </div>
              <h3 className={styles.choiceTitle}>1. Submit Support Form</h3>
              <p className={styles.choiceDesc}>
                Open an official inquiry reviewed directly by compliance officers & administrators. Track ticket status in real-time.
              </p>
            </div>

            {/* Choice 2: Telegram Contact - Only shown when enabled by Super Admin */}
            {platformConfig.telegramEnabled && (
              <div
                className={`${styles.choiceCard} ${styles.choiceCardTelegram} ${activeTab === 'telegram' ? styles.choiceCardActive : ''}`}
                onClick={() => {
                  setActiveTab('telegram');
                  setSelectedTicket(null);
                }}
              >
                <div className={styles.choiceCardTop}>
                  <div className={`${styles.choiceIconBadge} ${styles.choiceIconBadgeTg}`}>
                    <IconTelegram size={18} />
                  </div>
                  <span className={`${styles.choiceTag} ${styles.choiceTagLive}`}>Direct Contact</span>
                </div>
                <h3 className={styles.choiceTitle}>2. Telegram Support Desk</h3>
                <p className={styles.choiceDesc}>
                  Instant message our 24/7 trading desk team on Telegram for rapid answers, KYC questions, or order assistance.
                </p>
              </div>
            )}
          </div>

          {/* Sub-view selector tabs */}
          <div className={styles.viewTabs}>
            <button
              type="button"
              className={`${styles.viewTabBtn} ${activeTab === 'create' ? styles.viewTabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('create');
                setSelectedTicket(null);
              }}
            >
              <IconTicket size={14} />
              <span>Create Inquiry</span>
            </button>

            {platformConfig.telegramEnabled && (
              <button
                type="button"
                className={`${styles.viewTabBtn} ${activeTab === 'telegram' ? styles.viewTabBtnActive : ''}`}
                onClick={() => {
                  setActiveTab('telegram');
                  setSelectedTicket(null);
                }}
              >
                <IconTelegram size={14} />
                <span>Direct Telegram</span>
              </button>
            )}

            <button
              type="button"
              className={`${styles.viewTabBtn} ${activeTab === 'list' ? styles.viewTabBtnActive : ''}`}
              onClick={() => {
                setActiveTab('list');
                setSelectedTicket(null);
              }}
            >
              <IconClock size={14} />
              <span>My Inquiries {tickets.length > 0 && `(${tickets.length})`}</span>
            </button>
          </div>

          {/* Tab 1: Create Form */}
          {activeTab === 'create' && (
            <>
              {createdTicket ? (
                <div className={styles.successCard}>
                  <div className={styles.successIcon}>
                    <IconCheckCircle size={32} />
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: 'var(--text-primary)' }}>
                    Inquiry Submitted Successfully
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Your ticket has been dispatched to the HKFES administrator console.
                  </p>
                  <div className={styles.ticketBadgeBox}>
                    Ticket ID: {createdTicket.ticketNumber}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 20 }}>
                    Our compliance and support staff will review and respond. You will receive an in-app notification when an admin replies.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button
                      type="button"
                      className={styles.tgPrimaryBtn}
                      onClick={() => {
                        setSelectedTicket(createdTicket);
                        setActiveTab('list');
                      }}
                    >
                      View Ticket Thread
                    </button>
                    <button
                      type="button"
                      className={styles.tgSecondaryBtn}
                      onClick={() => {
                        setCreatedTicket(null);
                      }}
                    >
                      Submit Another
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateSubmit} className={styles.formGrid}>
                  {submitError && <div className={styles.errorBanner}>⚠️ {submitError}</div>}

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Inquiry Category</label>
                      <select
                        className={styles.select}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Priority Level</label>
                      <select
                        className={styles.select}
                        value={priority}
                        onChange={e => setPriority(e.target.value as any)}
                      >
                        <option value="normal">Normal (Default)</option>
                        <option value="high">High (Urgent settlement/order)</option>
                        <option value="urgent">Critical (Account lockout/funds)</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      <span>Subject Summary</span>
                      <span className={styles.labelHint}>Max 120 chars</span>
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. KYC verification inquiry or Deposit query"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      maxLength={120}
                      required
                    />
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Preferred Response Method</label>
                      <select
                        className={styles.select}
                        value={contactChannel}
                        onChange={e => setContactChannel(e.target.value as any)}
                      >
                        <option value="in_app">In-App Support Desk (Recommended)</option>
                        {platformConfig.telegramEnabled && (
                          <option value="telegram">Telegram Direct</option>
                        )}
                        <option value="email">Email Notification ({user?.email})</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>
                        <span>Contact Handle / ID</span>
                        <span className={styles.labelHint}>Optional</span>
                      </label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder={contactChannel === 'telegram' ? '@your_username' : 'Alternate contact handle'}
                        value={contactHandle}
                        onChange={e => setContactHandle(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      <span>Detailed Description</span>
                      <span className={styles.labelHint}>Explain what action is required</span>
                    </label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Provide specific details, transaction hashes, asset pairs, or document issues so our administrators can take immediate action..."
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <span>Dispatching to Administrators...</span>
                    ) : (
                      <>
                        <IconSend size={16} />
                        <span>Submit Support Ticket to Admin</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Tab 2: Telegram Direct Contact */}
          {activeTab === 'telegram' && (
            <div className={styles.telegramPanel}>
              <div className={styles.tgHeroIcon}>
                <IconTelegram size={36} />
              </div>
              <h3 className={styles.tgTitle}>Institutional Telegram Desk</h3>
              <p className={styles.tgDesc}>
                Connect directly with the HKFES Official Helpdesk on Telegram. Our team provides instant live support for trade inquiries, deposit verifications, and compliance escalations.
              </p>

              <div className={styles.tgMetaRow}>
                <div className={styles.tgMetaItem}>
                  <IconShieldCheck size={14} color="var(--brand-mint-500)" />
                  <span>Official Verified Channel</span>
                </div>
                <div className={styles.tgMetaItem}>
                  <IconClock size={14} color="#0284c7" />
                  <span>Avg Response: &lt; 5 mins</span>
                </div>
              </div>

              <div>
                <div className={styles.telegramHandleBadge}>
                  Handle: {telegramHandle}
                </div>
              </div>

              <div className={styles.tgActions}>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.tgPrimaryBtn}
                >
                  <IconExternalLink size={16} />
                  <span>Open in Telegram</span>
                </a>

                <button
                  type="button"
                  className={styles.tgSecondaryBtn}
                  onClick={handleCopyTelegram}
                >
                  {copiedHandle ? (
                    <>
                      <IconCheck size={16} color="var(--brand-mint-500)" />
                      <span style={{ color: 'var(--brand-mint-500)', fontWeight: 700 }}>Handle Copied!</span>
                    </>
                  ) : (
                    <>
                      <IconCopy size={16} />
                      <span>Copy Handle</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: My Inquiries List or Selected Thread */}
          {activeTab === 'list' && (
            <>
              {selectedTicket ? (
                <div className={styles.threadWrap}>
                  <div className={styles.threadHeader}>
                    <button
                      type="button"
                      className={styles.backBtn}
                      onClick={() => setSelectedTicket(null)}
                    >
                      <IconArrowLeft size={14} />
                      <span>Back to list</span>
                    </button>
                    <div>
                      <span className={`badge ${selectedTicket.status === 'resolved' ? 'badge-gain' : selectedTicket.status === 'closed' ? 'badge-default' : 'badge-gold'}`}>
                        {selectedTicket.status.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-primary)' }}>
                      {selectedTicket.subject}
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Ticket #{selectedTicket.ticketNumber} · Category: {selectedTicket.category.toUpperCase()} · Priority: {selectedTicket.priority}
                    </span>
                  </div>

                  <div className={styles.msgList}>
                    {selectedTicket.messages?.map((msg: any) => {
                      const isUser = msg.authorRole === 'user';
                      const isSystem = msg.authorRole === 'system';
                      return (
                        <div
                          key={msg.id}
                          className={`${styles.msgBubble} ${isSystem ? styles.msgSystem : isUser ? styles.msgUser : styles.msgAdmin}`}
                        >
                          <div className={styles.msgAuthor}>
                            {msg.authorName || (isUser ? 'You' : 'HKFES Admin')}
                          </div>
                          <div>{msg.body}</div>
                          <div style={{ fontSize: '9px', opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedTicket.status !== 'closed' ? (
                    <form onSubmit={handleReplySubmit} className={styles.replyBox}>
                      <input
                        type="text"
                        className={styles.replyInput}
                        placeholder="Type a response to the support admin..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                      />
                      <button
                        type="submit"
                        className={styles.replySendBtn}
                        disabled={replying || !replyText.trim()}
                        aria-label="Send reply"
                      >
                        <IconSend size={16} />
                      </button>
                    </form>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                      This ticket is closed. Submit a new form if you need additional assistance.
                    </div>
                  )}
                </div>
              ) : loadingTickets ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  Loading your inquiries...
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
                  <IconTicket size={36} color="var(--border-default)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}>You haven't submitted any support inquiries yet.</p>
                  <button
                    type="button"
                    className={styles.tgSecondaryBtn}
                    onClick={() => setActiveTab('create')}
                    style={{ margin: '0 auto' }}
                  >
                    Submit Your First Ticket
                  </button>
                </div>
              ) : (
                <div className={styles.ticketList}>
                  {tickets.map(t => (
                    <div
                      key={t.id}
                      className={styles.ticketItem}
                      onClick={() => loadTicketDetail(t.id)}
                    >
                      <div className={styles.ticketItemLeft}>
                        <span className={styles.ticketItemNum}>#{t.ticketNumber}</span>
                        <span className={styles.ticketItemSub}>{t.subject}</span>
                        <span className={styles.ticketItemDate}>
                          Updated {new Date(t.lastActivityAt || t.createdAt).toLocaleDateString()} · {t._count?.messages || 0} messages
                        </span>
                      </div>
                      <div>
                        <span className={`badge ${t.status === 'resolved' ? 'badge-gain' : t.status === 'closed' ? 'badge-default' : 'badge-gold'}`}>
                          {t.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Floating Helpdesk Button launcher placed globally on bottom right */
export function SupportFloatingLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className={styles.floatingLauncher}
      onClick={onOpen}
      title="Open Client Support Desk (Tickets & Telegram)"
      aria-label="Open Client Support Desk"
    >
      <div className={styles.floatingIconPulse}>
        <IconHeadphones size={15} />
      </div>
      <span className={styles.floatingText}>Support</span>
    </button>
  );
}
