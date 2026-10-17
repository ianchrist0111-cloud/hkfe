import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconShieldCheck,
  IconAlertCircle,
  IconWallet,
  IconSearch,
  IconX,
  IconCrown,
  IconBan,
  IconDollarSign,
  IconArrowRight,
  IconCheckCircle
} from '../../components/common/Icons';
import styles from './Admin.module.css';

interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  kycStatus: string;
  tradingBlocked?: boolean;
  withdrawalsBlocked?: boolean;
  depositsBlocked?: boolean;
  createdAt: string;
  wallet?: {
    totalBalance: number;
    availableBalance: number;
  };
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'admin' | 'suspended'>('all');
  const [resetModalUser, setResetModalUser] = useState<PlatformUser | null>(null);
  const [newBalance, setNewBalance] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers(search, 1, 100);
      if (res.success && res.data?.users) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleToggleSuspend = async (user: PlatformUser) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await api.adminUpdateUser(user.id, { status: nextStatus });
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
        setToastMsg(`User ${user.firstName} ${user.lastName} is now ${nextStatus.toUpperCase()}.`);
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTrading = async (user: PlatformUser) => {
    const nextTradingBlocked = !user.tradingBlocked;
    try {
      const res = await api.adminUpdateUser(user.id, { tradingBlocked: nextTradingBlocked });
      if (res.success) {
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, tradingBlocked: nextTradingBlocked } : u));
        setToastMsg(`Trading ${nextTradingBlocked ? 'disallowed' : 'allowed'} for ${user.firstName} ${user.lastName}.`);
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetBalanceConfirm = async () => {
    if (!resetModalUser) return;
    try {
      const res = await api.adminResetBalance(resetModalUser.id, newBalance, 'Admin Manual Adjustment');
      if (res.success) {
        setToastMsg(`Paper balance reset to $${newBalance.toLocaleString()} USD for ${resetModalUser.firstName}`);
        setUsers(prev => prev.map(u => {
          if (u.id === resetModalUser.id && u.wallet) {
            return { ...u, wallet: { ...u.wallet, totalBalance: newBalance, availableBalance: newBalance } };
          }
          return u;
        }));
        setResetModalUser(null);
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.status === 'active').length;
    const pendingKyc = users.filter(u => u.kycStatus === 'pending').length;
    const totalLiabilities = users.reduce((sum, u) => sum + (u.wallet?.totalBalance || 0), 0);
    return { total, active, pendingKyc, totalLiabilities };
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filter === 'pending' && u.kycStatus !== 'pending') return false;
      if (filter === 'admin' && u.role !== 'admin' && u.role !== 'super_admin') return false;
      if (filter === 'suspended' && u.status !== 'suspended') return false;
      return true;
    });
  }, [users, filter]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>User Account Moderation</h1>
          <p className={styles.pageSubtitle}>
            Directory governance, KYC risk reviews, simulated paper liquidity, and security access controls.
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/admin/kyc')}>
          <IconShieldCheck size={17} />
          <span>KYC Verification Queue</span>
          {stats.pendingKyc > 0 && (
            <span style={{
              background: '#07090e',
              color: '#00e599',
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              fontWeight: 800,
            }}>
              {stats.pendingKyc}
            </span>
          )}
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statIconWrap}>
              <IconUsers size={20} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--brand-mint-500)', fontWeight: 700 }}>
              REGISTERED
            </span>
          </div>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>Platform Accounts</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIconWrap} ${styles.statIconWrapIndigo}`}>
              <IconUserCheck size={20} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-gain)', fontWeight: 700 }}>
              HEALTHY
            </span>
          </div>
          <div className={styles.statValue}>{stats.active}</div>
          <div className={styles.statLabel}>Active Trading Clients</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={`${styles.statIconWrap} ${styles.statIconWrapGold}`}>
              <IconAlertCircle size={20} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--accent-gold)', fontWeight: 700 }}>
              ACTION REQ
            </span>
          </div>
          <div className={styles.statValue}>{stats.pendingKyc}</div>
          <div className={styles.statLabel}>Pending KYC Documents</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <div className={styles.statIconWrap}>
              <IconWallet size={20} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
              PAPER MINT
            </span>
          </div>
          <div className={styles.statValue} style={{ color: 'var(--accent-gold)' }}>
            ${(stats.totalLiabilities / 1000).toFixed(1)}k
          </div>
          <div className={styles.statLabel}>Total Paper Equity</div>
        </div>
      </div>

      {toastMsg && (
        <div style={{
          background: 'rgba(0, 229, 153, 0.10)',
          border: '1px solid rgba(0, 229, 153, 0.3)',
          color: 'var(--color-gain)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <IconCheckCircle size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <IconSearch size={16} color="var(--text-muted)" />
          <input
            placeholder="Search users by name, email, or user ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch('')} aria-label="Clear search">
              <IconX size={14} />
            </button>
          )}
        </div>

        <div className={styles.filterBar}>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilter('all')}
          >
            <IconUsers size={14} />
            <span>All Users</span>
            <span className={styles.filterCount}>{users.length}</span>
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'pending' ? styles.filterActive : ''}`}
            onClick={() => setFilter('pending')}
          >
            <IconAlertCircle size={14} />
            <span>Pending KYC</span>
            <span className={styles.filterCount}>{stats.pendingKyc}</span>
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'admin' ? styles.filterActive : ''}`}
            onClick={() => setFilter('admin')}
          >
            <IconCrown size={14} />
            <span>Admins</span>
            <span className={styles.filterCount}>
              {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
            </span>
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'suspended' ? styles.filterActive : ''}`}
            onClick={() => setFilter('suspended')}
          >
            <IconBan size={14} />
            <span>Suspended</span>
            <span className={styles.filterCount}>
              {users.filter(u => u.status === 'suspended').length}
            </span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading user records from secure registry...
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
          No accounts found matching current query or filters.
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Trader / Account</span>
            <span>Platform Role</span>
            <span>KYC Compliance</span>
            <span>Simulated Balance</span>
            <span>Registered</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {filtered.map(u => {
            const isSuper = u.role === 'super_admin';
            const isAdmin = u.role === 'admin';
            const isSuspended = u.status === 'suspended';

            return (
              <div key={u.id} className={styles.tableRow}>
                <div className={styles.userCell}>
                  <div className={styles.avatarWrapper}>
                    <div className={`${styles.userAvatar} ${isSuper ? styles.userAvatarSuper : isAdmin ? styles.userAvatarAdmin : ''}`}>
                      {u.firstName?.[0] || 'U'}{u.lastName?.[0] || ''}
                    </div>
                    <span className={`${styles.statusDot} ${isSuspended ? styles.statusDotSuspended : ''}`} />
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{u.firstName} {u.lastName}</span>
                    <span className={styles.userEmail}>{u.email}</span>
                  </div>
                </div>

                <div>
                  <span className={`badge ${isSuper ? 'badge-gold' : isAdmin ? 'badge-teal' : 'badge-default'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isSuper ? <IconCrown size={12} /> : isAdmin ? <IconShieldCheck size={12} /> : null}
                    <span>{u.role.replace('_', ' ')}</span>
                  </span>
                </div>

                <div>
                  <span className={`badge badge-${u.kycStatus === 'approved' ? 'gain' : u.kycStatus === 'pending' ? 'medium' : u.kycStatus === 'not_started' ? 'default' : 'loss'}`}>
                    {u.kycStatus.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                <div>
                  <strong className="mono" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                    ${(u.wallet?.totalBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </span>

                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                    <span className={`badge badge-${isSuspended ? 'loss' : 'gain'}`}>
                      {u.status.toUpperCase()}
                    </span>
                    {u.tradingBlocked && (
                      <span className="badge badge-loss" style={{ fontSize: '9px', padding: '1px 5px' }} title="Trading disallowed">
                        NO TRADING
                      </span>
                    )}
                    {u.withdrawalsBlocked && (
                      <span className="badge badge-loss" style={{ fontSize: '9px', padding: '1px 5px' }} title="Withdrawals blocked">
                        NO W/D
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.actionBtns}>
                  <button
                    className={styles.btnActionInspect}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    title="Inspect account dossier"
                  >
                    <span>Inspect</span>
                    <IconArrowRight size={12} />
                  </button>
                  <button
                    className={u.tradingBlocked ? styles.btnActionUnsuspend : styles.btnActionSuspend}
                    onClick={() => handleToggleTrading(u)}
                    title={u.tradingBlocked ? 'Allow trading privileges' : 'Disallow trading privileges'}
                  >
                    {u.tradingBlocked ? <IconCheckCircle size={12} /> : <IconBan size={12} />}
                    <span>{u.tradingBlocked ? 'Allow Trade' : 'Disallow Trade'}</span>
                  </button>
                  <button
                    className={styles.btnActionReset}
                    onClick={() => {
                      setResetModalUser(u);
                      setNewBalance(u.wallet?.totalBalance ?? 0);
                    }}
                    title="Adjust paper balance"
                  >
                    <IconDollarSign size={12} />
                    <span>Balance</span>
                  </button>
                  <button
                    className={isSuspended ? styles.btnActionUnsuspend : styles.btnActionSuspend}
                    onClick={() => handleToggleSuspend(u)}
                    title={isSuspended ? 'Reactivate trading access' : 'Suspend account'}
                  >
                    {isSuspended ? <IconUserCheck size={12} /> : <IconBan size={12} />}
                    <span>{isSuspended ? 'Unsuspend' : 'Suspend'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resetModalUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                <IconDollarSign size={22} />
              </div>
              <div>
                <h3 className={styles.modalTitle}>Adjust Paper Wallet Balance</h3>
                <p className={styles.modalDesc}>
                  Account: <strong>{resetModalUser.firstName} {resetModalUser.lastName}</strong> ({resetModalUser.email})
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 8 }}>
                Simulated Balance (USD):
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0 14px',
                height: '46px',
              }}>
                <span style={{ color: 'var(--brand-mint-500)', fontWeight: 800, fontSize: '18px', marginRight: 6 }}>$</span>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-xl)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                  value={newBalance}
                  onChange={e => setNewBalance(Number(e.target.value))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '12px' }}>
                {[0, 5000, 10000, 25000, 50000, 100000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    className={styles.filterBtn}
                    style={{
                      justifyContent: 'center',
                      fontSize: '11px',
                      background: newBalance === amt ? 'rgba(0, 229, 153, 0.15)' : 'var(--bg-elevated)',
                      color: newBalance === amt ? 'var(--brand-mint-500)' : 'var(--text-secondary)',
                      borderColor: newBalance === amt ? 'var(--brand-mint-500)' : 'var(--border-subtle)',
                      border: '1px solid',
                    }}
                    onClick={() => setNewBalance(amt)}
                  >
                    ${(amt / 1000)}k
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className={styles.btnSecondary}
                onClick={() => setResetModalUser(null)}
              >
                Cancel
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleResetBalanceConfirm}
              >
                <IconCheckCircle size={16} />
                <span>Apply Balance</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
