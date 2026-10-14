import { useState, useEffect } from 'react';
import { api, API_BASE_URL } from '../../lib/api';
import { usePriceStore } from '../../store';
import styles from './Admin.module.css';

export default function AdminReportsPage() {
  const ticks = usePriceStore(s => s.ticks);
  const [reportData, setReportData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          api.getAdminStats(),
          api.getAdminUsers('', 1, 50),
        ]);
        if (statsRes.success) setReportData(statsRes.data);
        if (usersRes.success && usersRes.data?.users) setUsers(usersRes.data.users);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalVol = Object.values(ticks).reduce((s, t) => s + (t.volume24h || 0), 0);
  const totalUserBalance = users.reduce((acc, u) => acc + (u.wallet?.totalBalance || 0), 0);

  const handleDownloadCsv = () => {
    window.open(`${API_BASE_URL}/admin/reports/generate?format=csv`, '_blank');
  };

  const handleExportUserBalancesCsv = () => {
    let csv = 'User ID,Name,Email,Role,KYC Status,Account Status,Paper Balance USD\n';
    users.forEach(u => {
      csv += `"${u.id}","${u.firstName} ${u.lastName}","${u.email}","${u.role}","${u.kycStatus}","${u.status}",${u.wallet?.totalBalance || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hkfes-user-balances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Institutional Compliance Reports</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Generate and export regulatory paper audit summaries, balance distributions, and volume metrics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.btnCreate} onClick={handleDownloadCsv}>
            ⬇ Export Platform Report (CSV)
          </button>
          <button className={styles.actionBtn} onClick={handleExportUserBalancesCsv}>
            ⬇ User Ledger (CSV)
          </button>
        </div>
      </div>

      <div className={styles.reportsGrid}>
        {/* Platform Overview */}
        <div className={styles.reportCard}>
          <h3>📊 Platform Liquidity & Users</h3>
          <div className={styles.reportRows}>
            <div>
              <span>Total User Profiles</span>
              <strong>{users.length}</strong>
            </div>
            <div>
              <span>Verified Traders (Approved)</span>
              <strong style={{ color: 'var(--color-gain)' }}>
                {users.filter(u => u.kycStatus === 'approved').length}
              </strong>
            </div>
            <div>
              <span>KYC Awaiting Review</span>
              <strong style={{ color: 'var(--color-warning)' }}>
                {users.filter(u => u.kycStatus === 'pending').length}
              </strong>
            </div>
            <div>
              <span>Authorized Admin Staff</span>
              <strong>{users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}</strong>
            </div>
            <div>
              <span>Total Simulated Paper Capital</span>
              <strong style={{ color: 'var(--accent-gold)' }}>
                ${Math.round(totalUserBalance).toLocaleString()} USD
              </strong>
            </div>
            <div>
              <span>Simulated 24H Volume</span>
              <strong>${Math.round(totalVol / 1000).toLocaleString()}K USD</strong>
            </div>
          </div>
        </div>

        {/* Paper Balances Breakdown */}
        <div className={styles.reportCard}>
          <h3>💰 Client Capital Distribution</h3>
          <div className={styles.reportRows} style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {users.map(u => (
              <div key={u.id}>
                <span>{u.firstName} {u.lastName} ({u.role})</span>
                <strong className="mono">${(u.wallet?.totalBalance || 0).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Benchmark Asset Matrix */}
        <div className={styles.reportCard}>
          <h3>📈 Asset Price Benchmark Matrix</h3>
          <div className={styles.reportRows} style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {Object.values(ticks).map(t => (
              <div key={t.symbol}>
                <span>{t.symbol}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <strong className="mono">
                    {t.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className={t.changePct >= 0 ? styles.up : styles.dn} style={{ fontSize: 'var(--text-xs)' }}>
                    {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}