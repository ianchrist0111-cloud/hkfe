import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePriceStore, useAuthStore } from '../../store';
import { api } from '../../lib/api';
import styles from './Admin.module.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const ticks = usePriceStore(s => s.ticks);
  const user = useAuthStore(s => s.user);

  const [stats, setStats] = useState({
    totalUsers: 9,
    activeOpenTrades: 4,
    totalSimulatedVolumeUsd: 184500,
    totalPlatformAssetsUsd: 462950,
    priceFeedStatus: 'running',
    pendingKyc: 1,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers('', 1, 5),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(prev => ({
          ...prev,
          totalUsers: statsRes.data.totalUsers || prev.totalUsers,
          activeOpenTrades: statsRes.data.activeOpenTrades || prev.activeOpenTrades,
          totalSimulatedVolumeUsd: statsRes.data.totalSimulatedVolumeUsd || prev.totalSimulatedVolumeUsd,
          totalPlatformAssetsUsd: statsRes.data.totalPlatformAssetsUsd || prev.totalPlatformAssetsUsd,
          priceFeedStatus: statsRes.data.priceFeedStatus || prev.priceFeedStatus,
        }));
      }

      if (usersRes.success && usersRes.data?.users) {
        setRecentUsers(usersRes.data.users);
        const pending = usersRes.data.users.filter((u: any) => u.kycStatus === 'pending').length;
        setStats(prev => ({ ...prev, pendingKyc: pending }));
      }
    } catch (err) {
      console.error('Error fetching admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBulkReset = async () => {
    if (!window.confirm('Reset all demo paper user wallets back to $10,000 USD?')) return;
    try {
      const res = await api.adminBulkResetBalance();
      if (res.success) {
        setActionMsg('✓ All user wallets reset to $10,000 USD successfully.');
        loadData();
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const statCards = [
    {
      label: 'Total Registered Profiles',
      value: stats.totalUsers.toString(),
      icon: '👥',
      change: 'Active in SQLite',
    },
    {
      label: 'Open Exposure Positions',
      value: stats.activeOpenTrades.toString(),
      icon: '📈',
      change: 'Live Market Risk',
    },
    {
      label: 'Total Paper Liabilities',
      value: `$${Math.round(stats.totalPlatformAssetsUsd).toLocaleString()}`,
      icon: '🏦',
      change: '100% Backed Reserve',
    },
    {
      label: 'KYC Pending Review',
      value: stats.pendingKyc.toString(),
      icon: '🛡️',
      change: stats.pendingKyc > 0 ? 'Action Required' : 'All Clear',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Compliance & Risk Overview</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Welcome back, {user?.firstName} ({user?.role === 'super_admin' ? 'Root Super Admin' : 'Compliance Officer'}).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.btnCreate} onClick={() => navigate('/admin/kyc')}>
            🛡️ Review KYC Queue
          </button>
          <button className={styles.actionBtn} onClick={handleBulkReset}>
            ↺ Bulk Reset Wallets
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--color-gain)',
          color: 'var(--color-gain)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}>
          {actionMsg}
        </div>
      )}

      <div className={styles.statsGrid}>
        {statCards.map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statIcon}>{s.icon}</span>
              <span className={styles.statChange}>{s.change}</span>
            </div>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => navigate('/admin/kyc')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>KYC Compliance Queue</strong>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Inspect uploaded passports & driver's licenses and approve or reject applications.
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => navigate('/admin/engine')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Market Volatility Injector</strong>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Simulate Bull Rallies (+15%) and Flash Crashes (-20%) on BTC, Forex, and Equities.
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => navigate('/admin/users')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>👥</span>
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>User Account Moderation</strong>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Suspend accounts, adjust paper balances, and inspect client trading portfolios.
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onClick={() => navigate('/admin/audit-logs')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>📋</span>
            <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Immutable Audit Logs</strong>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Inspect full chronological log of all administrator and risk operations.
          </p>
        </div>
      </div>

      <div className={styles.dashboardSplitGrid}>
        <div className={styles.priceGrid}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Live Synthetic Price Engine</h3>
            <span style={{ fontSize: '11px', color: 'var(--color-gain)' }}>● Feed Connected (1000ms GBM)</span>
          </div>
          <div className={styles.priceList}>
            {Object.values(ticks).slice(0, 6).map(t => (
              <div key={t.symbol} className={styles.priceRow}>
                <span>{t.symbol}</span>
                <span className="mono">{t.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                <span className={t.changePct >= 0 ? styles.up : styles.dn}>
                  {t.changePct >= 0 ? '▲ +' : '▼ '}{t.changePct.toFixed(2)}%
                </span>
                <span
                  className={styles.dir}
                  style={{
                    background: t.direction === 'up' ? 'var(--color-gain-bg)' : t.direction === 'down' ? 'var(--color-loss-bg)' : 'var(--bg-elevated)',
                    color: t.direction === 'up' ? 'var(--color-gain)' : t.direction === 'down' ? 'var(--color-loss)' : 'var(--text-muted)',
                  }}
                >
                  {t.direction}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.recentUsers}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Registered Test Personas & Accounts</h3>
            <button className={styles.btnView} onClick={() => navigate('/admin/users')}>
              View All ({stats.totalUsers}) →
            </button>
          </div>
          {recentUsers.map(u => (
            <div key={u.id} className={styles.userRow}>
              <div className={styles.userAvatar}>{u.firstName?.[0]}{u.lastName?.[0]}</div>
              <div className={styles.userRowInfo}>
                <strong>{u.firstName} {u.lastName}</strong>
                <p>{u.email}</p>
              </div>
              <span className={`badge badge-${u.kycStatus === 'approved' ? 'gain' : u.kycStatus === 'pending' ? 'medium' : u.kycStatus === 'not_started' ? 'default' : 'loss'}`}>
                KYC: {u.kycStatus.replace('_', ' ')}
              </span>
              <span className={`badge ${u.role === 'admin' ? 'badge-gold' : 'badge-teal'}`}>
                {u.role}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                ${(u.wallet?.totalBalance ?? 0).toLocaleString()} USD
              </span>
              <button className={styles.btnView} onClick={() => navigate(`/admin/users/${u.id}`)}>
                Inspect →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
