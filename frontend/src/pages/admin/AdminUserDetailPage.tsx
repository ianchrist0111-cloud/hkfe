import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store';
import {
  IconArrowLeft,
  IconCheckCircle,
  IconBan,
  IconUserCheck,
  IconShieldCheck,
  IconX,
  IconDollarSign,
  IconWallet,
  IconTrade,
  IconBot,
  IconFileText,
  IconSliders,
  IconCrown,
  IconUser,
  IconAlertCircle,
} from '../../components/common/Icons';
import styles from './Admin.module.css';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const actor = useAuthStore(s => s.user);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [newBalance, setNewBalance] = useState(0);
  const [copiedUuid, setCopiedUuid] = useState(false);
  const [staffPassword, setStaffPassword] = useState('');
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [issuingPassword, setIssuingPassword] = useState(false);

  const fetchUserDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getAdminUser(id);
      if (res.success && res.data) {
        setUser(res.data);
        if (res.data.wallet?.totalBalance !== undefined) {
          setNewBalance(res.data.wallet.totalBalance);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const handleGeneratePassword = async () => {
    if (!user) return;
    setIssuingPassword(true);
    const res = await api.adminGeneratePassword(user.id);
    setIssuingPassword(false);
    if (res.success && res.data?.password) {
      setIssuedPassword(res.data.password);
      setMsg(res.data.message || 'New password generated.');
    } else {
      setMsg(res.error?.message || 'Could not generate a password.');
    }
    setTimeout(() => setMsg(null), 6000);
  };

  const handleSetPassword = async () => {
    if (!user) return;
    if (staffPassword.length < 8) {
      setMsg('Password must be at least 8 characters.');
      setTimeout(() => setMsg(null), 4000);
      return;
    }
    const res = await api.adminSetPassword(user.id, staffPassword);
    if (res.success) {
      setStaffPassword('');
      setMsg(res.data?.message || 'Password updated.');
    } else {
      setMsg(res.error?.message || 'Could not set that password.');
    }
    setTimeout(() => setMsg(null), 5000);
  };

  const handleUpdateStatus = async (status: 'active' | 'suspended') => {
    if (!user) return;
    try {
      const res = await api.adminUpdateUser(user.id, { status });
      if (res.success) {
        setUser((prev: any) => ({ ...prev, status }));
        setMsg(`Account status successfully updated to "${status.toUpperCase()}".`);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateKyc = async (kycStatus: 'approved' | 'rejected') => {
    if (!user) return;
    try {
      const res = await api.adminUpdateUser(user.id, { kycStatus });
      if (res.success) {
        setUser((prev: any) => ({ ...prev, kycStatus }));
        setMsg(`KYC verification status updated to "${kycStatus.toUpperCase()}".`);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTrading = async () => {
    if (!user) return;
    const nextState = !user.tradingBlocked;
    try {
      const res = await api.adminUpdateUser(user.id, { tradingBlocked: nextState });
      if (res.success) {
        setUser((prev: any) => ({ ...prev, tradingBlocked: nextState }));
        setMsg(`Trading execution is now ${nextState ? 'DISALLOWED / BLOCKED' : 'ALLOWED / ENABLED'} for ${user.firstName}.`);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleWithdrawals = async () => {
    if (!user) return;
    const nextState = !user.withdrawalsBlocked;
    try {
      const res = await api.adminUpdateUser(user.id, { withdrawalsBlocked: nextState });
      if (res.success) {
        setUser((prev: any) => ({ ...prev, withdrawalsBlocked: nextState }));
        setMsg(`Withdrawals are now ${nextState ? 'RESTRICTED / BLOCKED' : 'ALLOWED / ENABLED'} for ${user.firstName}.`);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleDeposits = async () => {
    if (!user) return;
    const nextState = !user.depositsBlocked;
    try {
      const res = await api.adminUpdateUser(user.id, { depositsBlocked: nextState });
      if (res.success) {
        setUser((prev: any) => ({ ...prev, depositsBlocked: nextState }));
        setMsg(`Deposits are now ${nextState ? 'RESTRICTED / BLOCKED' : 'ALLOWED / ENABLED'} for ${user.firstName}.`);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBalance = async () => {
    if (!user) return;
    try {
      const res = await api.adminResetBalance(user.id, newBalance, 'Admin Manual Adjustment');
      if (res.success) {
        setMsg(`Simulated paper balance reset to $${newBalance.toLocaleString()} USD.`);
        setUser((prev: any) => ({
          ...prev,
          wallet: { ...prev.wallet, totalBalance: newBalance, availableBalance: newBalance }
        }));
        setShowBalanceModal(false);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyUuid = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedUuid(true);
    setTimeout(() => setCopiedUuid(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', color: 'var(--text-muted)', textAlign: 'center' }}>
        Loading comprehensive user dossier...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>User record not found in system registry.</p>
        <button
          className={styles.btnSecondary}
          onClick={() => navigate('/admin/users')}
        >
          <IconArrowLeft size={16} />
          <span>Back to Users Directory</span>
        </button>
      </div>
    );
  }

  const wallet = user.wallet || { totalBalance: 0, availableBalance: 0, reservedTrading: 0, reservedEarn: 0, reservedBots: 0 };
  const kyc = user.kycRecord;
  const trades = user.trades || [];
  const subscriptions = user.strategySubscriptions || [];
  const isSuper = user.role === 'super_admin';
  const isAdmin = user.role === 'admin';
  const isSuspended = user.status === 'suspended';

  const total = wallet.totalBalance || 1;
  const pctAvailable = Math.max(0, Math.min(100, (wallet.availableBalance / total) * 100));
  const pctTrading = Math.max(0, Math.min(100, ((wallet.reservedTrading || 0) / total) * 100));
  const pctEarn = Math.max(0, Math.min(100, ((wallet.reservedEarn || 0) / total) * 100));
  const pctBots = Math.max(0, Math.min(100, ((wallet.reservedBots || 0) / total) * 100));

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/users')}>
          <IconArrowLeft size={16} />
          <span>Back to Users Directory</span>
        </button>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={styles.btnSecondary} onClick={() => setShowBalanceModal(true)}>
            <IconDollarSign size={15} color="var(--accent-gold)" />
            <span>Adjust Paper Balance</span>
          </button>
          {user.tradingBlocked ? (
            <button className={styles.btnActionUnsuspend} style={{ padding: '8px 14px', fontSize: 'var(--text-xs)' }} onClick={handleToggleTrading} title="Allow user to execute orders">
              <IconTrade size={15} />
              <span>Allow Trading</span>
            </button>
          ) : (
            <button className={styles.btnActionSuspend} style={{ padding: '8px 14px', fontSize: 'var(--text-xs)' }} onClick={handleToggleTrading} title="Disallow user from placing new orders">
              <IconBan size={15} />
              <span>Disallow Trading</span>
            </button>
          )}
          {isSuspended ? (
            <button className={styles.btnActionUnsuspend} style={{ padding: '8px 14px', fontSize: 'var(--text-xs)' }} onClick={() => handleUpdateStatus('active')}>
              <IconUserCheck size={15} />
              <span>Reactivate Account</span>
            </button>
          ) : (
            <button className={styles.btnActionSuspend} style={{ padding: '8px 14px', fontSize: 'var(--text-xs)' }} onClick={() => handleUpdateStatus('suspended')}>
              <IconBan size={15} />
              <span>Suspend Account</span>
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div style={{ background: 'rgba(0, 229, 153, 0.10)', border: '1px solid rgba(0, 229, 153, 0.3)', color: 'var(--color-gain)', padding: '12px 18px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconCheckCircle size={18} />
          <span>{msg}</span>
        </div>
      )}

      <div className={styles.userDetailLayout}>
        <div className={styles.userDetailCard}>
          <div className={`${styles.userDetailAvatar} ${isSuper ? styles.userAvatarSuper : isAdmin ? styles.userAvatarAdmin : ''}`}>
            {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
          </div>
          <h2>{user.firstName} {user.lastName}</h2>
          <p>{user.email}</p>

          <div className={styles.detailBadges}>
            <span className={`badge badge-${user.kycStatus === 'approved' ? 'gain' : user.kycStatus === 'pending' ? 'medium' : user.kycStatus === 'not_started' ? 'default' : 'loss'}`}>
              KYC: {user.kycStatus.replace('_', ' ').toUpperCase()}
            </span>
            <span className={`badge ${isSuper ? 'badge-gold' : isAdmin ? 'badge-teal' : 'badge-default'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {isSuper ? <IconCrown size={12} /> : isAdmin ? <IconShieldCheck size={12} /> : <IconUser size={12} />}
              <span>{user.role.replace('_', ' ')}</span>
            </span>
            <span className={`badge badge-${isSuspended ? 'loss' : 'gain'}`}>
              {user.status.toUpperCase()}
            </span>
            {user.tradingBlocked && (
              <span className="badge badge-loss" title="Trading privileges disabled">
                NO TRADING
              </span>
            )}
            {user.withdrawalsBlocked && (
              <span className="badge badge-loss" title="Withdrawals blocked">
                NO WITHDRAWALS
              </span>
            )}
            {user.depositsBlocked && (
              <span className="badge badge-loss" title="Deposits blocked">
                NO DEPOSITS
              </span>
            )}
          </div>

          <div className={styles.sidebarMetaList}>
            <div className={styles.sidebarMetaItem}>
              <span className={styles.sidebarMetaLabel}>User UUID:</span>
              <button type="button" onClick={handleCopyUuid} style={{ background: 'transparent', border: 'none', color: copiedUuid ? 'var(--brand-mint-500)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }} title="Click to copy UUID">
                <span>{user.id.slice(0, 8)}...</span>
                <span>{copiedUuid ? '✓' : '⧉'}</span>
              </button>
            </div>
            <div className={styles.sidebarMetaItem}>
              <span className={styles.sidebarMetaLabel}>Registered:</span>
              <span className={styles.sidebarMetaVal}>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
            <div className={styles.sidebarMetaItem}>
              <span className={styles.sidebarMetaLabel}>Country:</span>
              <span className={styles.sidebarMetaVal}>{kyc?.country || 'US'}</span>
            </div>
            <div className={styles.sidebarMetaItem}>
              <span className={styles.sidebarMetaLabel}>Verification:</span>
              <span className={styles.sidebarMetaVal} style={{ color: user.kycStatus === 'approved' ? 'var(--color-gain)' : 'var(--accent-gold)' }}>
                {user.kycStatus === 'approved' ? 'Tier 2 Institutional' : 'Unverified Tier 1'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.detailInfo}>
          <div className={styles.detailSectionCard}>
            <div className={styles.detailSectionHeader}>
              <div className={styles.detailSectionTitle}>
                <IconWallet size={18} color="var(--brand-mint-500)" />
                <span>Simulated Paper Wallet Breakdown</span>
              </div>
              <strong className="mono" style={{ fontSize: 'var(--text-lg)', color: 'var(--accent-gold)' }}>
                ${wallet.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </strong>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>Asset Partitioning</span>
                <span>Available: {pctAvailable.toFixed(0)}% • Trading: {pctTrading.toFixed(0)}% • Vaults: {pctEarn.toFixed(0)}% • Bots: {pctBots.toFixed(0)}%</span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ width: `${pctAvailable}%`, background: 'var(--brand-mint-500)' }} title="Available Margin" />
                <div style={{ width: `${pctTrading}%`, background: 'var(--accent-teal)' }} title="Trading Margin Lock" />
                <div style={{ width: `${pctEarn}%`, background: 'var(--accent-gold)' }} title="Earn Vaults" />
                <div style={{ width: `${pctBots}%`, background: 'var(--brand-bot-500)' }} title="Bot Allocations" />
              </div>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailGridItem}>
                <span className={styles.detailGridLabel}>Total Net Equity</span>
                <span className={`${styles.detailGridVal} mono`} style={{ color: 'var(--accent-gold)' }}>
                  ${wallet.totalBalance.toLocaleString()} USD
                </span>
              </div>
              <div className={styles.detailGridItem}>
                <span className={styles.detailGridLabel}>Available Margin</span>
                <span className={`${styles.detailGridVal} mono`} style={{ color: 'var(--brand-mint-500)' }}>
                  ${wallet.availableBalance.toLocaleString()} USD
                </span>
              </div>
              <div className={styles.detailGridItem}>
                <span className={styles.detailGridLabel}>Trading Margin Lock</span>
                <span className={`${styles.detailGridVal} mono`}>
                  ${(wallet.reservedTrading || 0).toLocaleString()} USD
                </span>
              </div>
              <div className={styles.detailGridItem}>
                <span className={styles.detailGridLabel}>Earn Vault Staked</span>
                <span className={`${styles.detailGridVal} mono`}>
                  ${(wallet.reservedEarn || 0).toLocaleString()} USD
                </span>
              </div>
              <div className={styles.detailGridItem}>
                <span className={styles.detailGridLabel}>Bot Grid Allocation</span>
                <span className={`${styles.detailGridVal} mono`}>
                  ${(wallet.reservedBots || 0).toLocaleString()} USD
                </span>
              </div>
              <div className={styles.detailGridItem}>
                <span className={styles.detailGridLabel}>Ledger Status</span>
                <span className={`${styles.detailGridVal}`} style={{ color: 'var(--color-gain)' }}>
                  Audited & Reconciled
                </span>
              </div>
            </div>
          </div>

          <div className={styles.detailSectionCard}>
            <div className={styles.detailSectionHeader}>
              <div className={styles.detailSectionTitle}>
                <IconSliders size={18} color="var(--accent-gold)" />
                <span>Compliance & Moderation Actions</span>
              </div>
            </div>

            <div className={styles.actionRow} style={{ marginBottom: 20 }}>
              {user.kycStatus !== 'approved' && (
                <button className={styles.actionBtn} style={{ color: 'var(--color-gain)', borderColor: 'rgba(16, 185, 129, 0.4)' }} onClick={() => handleUpdateKyc('approved')}>
                  <IconShieldCheck size={16} />
                  <span>Approve KYC Dossier</span>
                </button>
              )}

              {user.kycStatus !== 'rejected' && (
                <button className={styles.actionBtn} style={{ color: 'var(--color-loss)', borderColor: 'rgba(239, 68, 68, 0.4)' }} onClick={() => handleUpdateKyc('rejected')}>
                  <IconX size={16} />
                  <span>Reject KYC Dossier</span>
                </button>
              )}

              <button className={styles.actionBtn} style={{ color: 'var(--accent-gold)', borderColor: 'rgba(255, 183, 3, 0.4)' }} onClick={() => setShowBalanceModal(true)}>
                <IconDollarSign size={16} />
                <span>Adjust Simulated Balance</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showBalanceModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                <IconDollarSign size={22} />
              </div>
              <div>
                <h3 className={styles.modalTitle}>Adjust Simulated Paper Wallet</h3>
                <p className={styles.modalDesc}>Account: <strong>{user.firstName} {user.lastName}</strong> ({user.email})</p>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8 }}>
                New Balance Amount (USD):
              </label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0 14px', height: '46px' }}>
                <span style={{ color: 'var(--brand-mint-500)', fontWeight: 800, fontSize: '18px', marginRight: 6 }}>$</span>
                <input type="number" step="1000" min="0" style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 700, outline: 'none' }} value={newBalance} onChange={e => setNewBalance(Number(e.target.value))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '12px' }}>
                {[0, 5000, 10000, 25000, 50000, 100000].map(amt => (
                  <button key={amt} type="button" className={styles.filterBtn} style={{ justifyContent: 'center', fontSize: '11px', background: newBalance === amt ? 'rgba(0, 229, 153, 0.15)' : 'var(--bg-elevated)', color: newBalance === amt ? 'var(--brand-mint-500)' : 'var(--text-secondary)', borderColor: newBalance === amt ? 'var(--brand-mint-500)' : 'var(--border-subtle)', border: '1px solid' }} onClick={() => setNewBalance(amt)}>
                    ${amt === 0 ? '0' : `${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className={styles.btnSecondary} onClick={() => setShowBalanceModal(false)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} onClick={handleSaveBalance}>
                <IconCheckCircle size={16} />
                <span>Save New Balance</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
