import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SERVICES } from '../data';
import { useWalletStore, useServicesStore, useNotificationsStore } from '../store';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheckCircle,
  IconBot,
  IconActivity,
  IconSparkles,
  IconZap,
  IconTrade,
  IconShieldCheck,
  IconWallet
} from '../components/common/Icons';
import styles from './ServiceDetailPage.module.css';

function getServiceIcon(serviceType: string, id: string) {
  if (serviceType === 'grid_bot') return <IconBot size={24} color="var(--brand-bot-500)" />;
  if (serviceType === 'dca_bot') return <IconActivity size={24} color="var(--brand-bot-500)" />;
  if (serviceType === 'copy_trade') return <IconSparkles size={24} color="var(--brand-bot-500)" />;
  if (serviceType === 'arbitrage') return <IconZap size={24} color="var(--brand-bot-500)" />;
  if (serviceType === 'options') return <IconTrade size={24} color="var(--brand-mint-500)" />;
  if (id.includes('8')) return <IconShieldCheck size={24} color="var(--brand-mint-500)" />;
  return <IconWallet size={24} color="var(--brand-mint-500)" />;
}

export default function ServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const svc = SERVICES.find(s => s.id === id);
  const [alloc, setAlloc] = useState('1000');
  const [subscribed, setSubscribed] = useState(false);
  const { availableBalance } = useWalletStore();
  const { subscribe } = useServicesStore();
  const addNotif = useNotificationsStore(s => s.addNotification);

  if (!svc) {
    return (
      <div style={{ padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
        Service not found.{' '}
        <a
          onClick={() => navigate('/services')}
          style={{ color: 'var(--brand-mint-500)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconArrowLeft size={16} /> Back to Services
        </a>
      </div>
    );
  }

  const handleStart = () => {
    const amt = parseFloat(alloc);
    if (!amt || amt > availableBalance) return;
    subscribe({
      serviceId: svc.id,
      serviceName: svc.name,
      serviceType: svc.serviceType,
      status: 'active',
      allocatedUsd: amt,
      riskLevel: svc.riskLevel,
      simulatedApy: svc.simulatedApy,
      config: {}
    });
    addNotif({
      type: 'system',
      title: 'Service Activated',
      message: `${svc.name} is now active with $${amt.toLocaleString()} allocated.`
    });
    setSubscribed(true);
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/services')}>
        <IconArrowLeft size={16} />
        <span>Back to Services</span>
      </button>
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.header}>
            <div className={styles.icon}>
              {getServiceIcon(svc.serviceType, svc.id)}
            </div>
            <div>
              <h1>{svc.name}</h1>
              <div className={styles.badges}>
                <span className={`badge badge-${svc.riskLevel}`}>{svc.riskLevel} risk</span>
                {svc.simulatedApy && <span className="badge badge-teal">{svc.simulatedApy}% APY</span>}
                {svc.simulatedWeeklyReturn && <span className="badge badge-gain">{svc.simulatedWeeklyReturn}/wk</span>}
              </div>
            </div>
          </div>
          <p className={styles.desc}>{svc.fullDescription}</p>
          <div className={styles.section}>
            <h3>How It Works</h3>
            <ol className={styles.steps}>
              {svc.howItWorks.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
          <div className={styles.section}>
            <h3>FAQ</h3>
            {svc.faq.map((f, i) => (
              <details key={i} className={styles.faqItem}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className={styles.sidebar}>
          {subscribed ? (
            <div className={styles.successCard}>
              <div className={styles.successIconWrap}>
                <IconCheckCircle size={38} color="var(--color-gain)" />
              </div>
              <h3>Service Active!</h3>
              <p>
                {svc.name} is running with{' '}
                <strong style={{ color: 'var(--brand-mint-500)', fontFamily: 'var(--font-mono)' }}>
                  ${parseFloat(alloc).toLocaleString()}
                </strong>{' '}
                allocated.
              </p>
              <button className={styles.btnView} onClick={() => navigate('/dashboard')}>
                <span>View Dashboard</span>
                <IconArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className={styles.allocCard}>
              <h3>Start {svc.name}</h3>
              <div className={styles.allocField}>
                <label>Allocation (USD)</label>
                <input
                  type="number"
                  value={alloc}
                  onChange={e => setAlloc(e.target.value)}
                  min={svc.minAllocation}
                  max={availableBalance}
                  className={styles.allocInput}
                />
                <span className={styles.hint}>
                  Available: ${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              {svc.simulatedApy && (
                <div className={styles.yieldPreview}>
                  <span>Estimated yearly yield</span>
                  <strong style={{ color: 'var(--color-gain)', fontFamily: 'var(--font-mono)' }}>
                    +${((parseFloat(alloc) || 0) * svc.simulatedApy / 100).toFixed(2)}
                  </strong>
                </div>
              )}
              <button
                className={styles.btnStart}
                onClick={handleStart}
                disabled={!parseFloat(alloc) || parseFloat(alloc) > availableBalance}
              >
                Start Strategy (Simulated)
              </button>
              {parseFloat(alloc) > availableBalance && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-loss)', margin: 0 }}>
                  Insufficient available cash balance
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}