import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVICES } from '../data';
import { useUIStore } from '../store';
import {
  IconBot,
  IconWallet,
  IconShieldCheck,
  IconActivity,
  IconSparkles,
  IconZap,
  IconTrade
} from '../components/common/Icons';
import styles from './ServicesPage.module.css';

type Filter = 'all' | 'earn' | 'grid_bot' | 'dca_bot' | 'copy_trade' | 'arbitrage' | 'options';

function getServiceIcon(serviceType: string, id: string) {
  if (serviceType === 'grid_bot') return <IconBot size={22} color="var(--brand-bot-500)" />;
  if (serviceType === 'dca_bot') return <IconActivity size={22} color="var(--brand-bot-500)" />;
  if (serviceType === 'copy_trade') return <IconSparkles size={22} color="var(--brand-bot-500)" />;
  if (serviceType === 'arbitrage') return <IconZap size={22} color="var(--accent-gold)" />;
  if (serviceType === 'options') return <IconTrade size={22} color="var(--brand-mint-500)" />;
  if (id.includes('8')) return <IconShieldCheck size={22} color="var(--brand-mint-500)" />;
  return <IconWallet size={22} color="var(--brand-mint-500)" />;
}

export default function ServicesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { stealthMode } = useUIStore();

  const filters = [
    { id: 'all', label: 'All Products' },
    { id: 'earn', label: 'Fixed Staking' },
    { id: 'grid_bot', label: 'AI Grid Bots' },
    { id: 'dca_bot', label: 'DCA Accumulators' },
    { id: 'copy_trade', label: 'Copy Trading' },
    { id: 'arbitrage', label: 'Arbitrage' },
    { id: 'options', label: 'Yield Options' },
  ] as const;

  const filtered = SERVICES.filter(s => filter === 'all' || s.serviceType === filter);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerBadge}>
            <span className="live-pulse" />
            <span>INSTITUTIONAL YIELD & BOT VAULTS</span>
          </div>
          <h1 className={styles.headerTitle}>Automated Earning & Strategies</h1>
          <p className={styles.headerSub}>
            Deploy institutional-grade automated trading bots, high-yield staking vaults, and copy vetted pro traders.
          </p>
        </div>
      </div>

      {/* ── Hero Metrics Bar ── */}
      <div className={styles.metricsBar}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Total Value Deployed</span>
          <strong className={`mono ${styles.metricVal} ${stealthMode ? 'stealth-blur' : ''}`}>$42,850,000+</strong>
          <span className={styles.metricSub}>Across 12,400 active vaults</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Average Historical APY</span>
          <strong className={`mono ${styles.metricVal}`} style={{ color: 'var(--accent-primary)' }}>14.8% APY</strong>
          <span className={styles.metricSub}>Backtested & live verified</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Bot Execution Uptime</span>
          <strong className={`mono ${styles.metricVal}`} style={{ color: 'var(--accent-primary)' }}>99.98%</strong>
          <span className={styles.metricSub}>Zero-downtime microsecond execution</span>
        </div>
      </div>

      {/* ── Filter Tabs with Horizontal Fade Edge ── */}
      <div className="fadeEdgeTrack" style={{ padding: '6px 0', margin: '0 0 var(--space-2)' }}>
        {filters.map(f => (
          <button
            key={f.id}
            type="button"
            className={`filterPill ${filter === f.id ? 'filterPillActive' : ''}`}
            onClick={() => setFilter(f.id as Filter)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Product Grid ── */}
      <div className={styles.grid}>
        {filtered.map(svc => (
          <div
            key={svc.id}
            className={styles.card}
            style={{ '--accent': svc.serviceType.includes('bot') ? 'var(--brand-bot-500)' : 'var(--brand-mint-500)' } as React.CSSProperties}
            onClick={() => navigate('/services/' + svc.id)}
          >
            <div className={styles.cardTop}>
              <div
                className={styles.icon}
                style={{
                  background: svc.serviceType.includes('bot') ? 'var(--brand-bot-100)' : 'var(--brand-mint-100)',
                  border: `1px solid ${svc.serviceType.includes('bot') ? 'var(--brand-bot-300)' : 'var(--brand-mint-300)'}`,
                }}
              >
                {getServiceIcon(svc.serviceType, svc.id)}
              </div>
              <div className={styles.badges}>
                <span className={`${styles.riskBadge} ${styles['risk_' + svc.riskLevel]}`}>
                  {svc.riskLevel === 'low' && 'LOW RISK'}
                  {svc.riskLevel === 'medium' && 'MODERATE RISK'}
                  {svc.riskLevel === 'high' && 'ALPHA RISK'}
                </span>
                {svc.simulatedApy && (
                  <span className={styles.apyBadge}>
                    {svc.simulatedApy}% APY
                  </span>
                )}
                {svc.simulatedWeeklyReturn && !svc.simulatedApy && (
                  <span className={styles.apyBadge}>
                    {svc.simulatedWeeklyReturn}/wk
                  </span>
                )}
              </div>
            </div>

            <div className={styles.titleGroup}>
              <h2 className={styles.title}>{svc.name}</h2>
              {svc.assetSymbol && (
                <span className={styles.assetTag}>{svc.assetSymbol}</span>
              )}
            </div>

            <p className={styles.desc}>{svc.shortDescription}</p>

            <div className={styles.projectionWell}>
              <div className={styles.projItem}>
                <span className={styles.projLabel}>Min. Entry</span>
                <strong className="mono">${svc.minAllocation.toLocaleString()}</strong>
              </div>
              <div className={styles.projItem}>
                <span className={styles.projLabel}>Strategy Type</span>
                <strong style={{ textTransform: 'capitalize' }}>{svc.serviceType.replace('_', ' ')}</strong>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <button
                className={`${styles.btnDeploy} ${svc.serviceType.includes('bot') ? styles.btnBot : styles.btnMint}`}
              >
                Configure & Deploy →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

