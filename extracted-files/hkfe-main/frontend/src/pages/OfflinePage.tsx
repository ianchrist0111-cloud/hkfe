import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore, usePriceStore } from '../store';
import styles from './OfflinePage.module.css';

export default function OfflinePage() {
  const navigate = useNavigate();
  const totalBalance = useWalletStore(s => s.totalBalance);
  const ticks = usePriceStore(s => s.ticks);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          if (navigator.onLine) {
            navigate('/dashboard');
          }
          return 10;
        }
        return c - 1;
      });
    }, 1000);

    const onOnline = () => {
      navigate('/dashboard');
    };

    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.icon}>📡</div>
        <h1>Offline Mode Active</h1>
        <p className={styles.subtext}>
          HKFES is unable to establish an uplink with the market matching engine. You are viewing locally cached assets.
        </p>

        <div className={styles.cachedCard}>
          <div className={styles.cachedHeader}>
            <span>Cached Portfolio Equity</span>
            <span style={{ color: 'var(--color-warning)' }}>OFFLINE SNAPSHOT</span>
          </div>
          <div className={styles.cachedBalance}>
            ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>

          <div className={styles.cachedRows}>
            <div className={styles.cachedRow}>
              <span>BTC/USD (Last Tick):</span>
              <strong>${ticks['BTC/USD']?.price?.toLocaleString() || '64,250.00'}</strong>
            </div>
            <div className={styles.cachedRow}>
              <span>ETH/USD (Last Tick):</span>
              <strong>${ticks['ETH/USD']?.price?.toLocaleString() || '3,480.00'}</strong>
            </div>
            <div className={styles.cachedRow}>
              <span>Auto-Retry In:</span>
              <strong style={{ color: 'var(--accent-primary)' }}>{countdown}s</strong>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.retryBtn}
            onClick={() => {
              if (navigator.onLine) {
                navigate('/dashboard');
              } else {
                window.location.reload();
              }
            }}
          >
            Reconnect Now ⚡
          </button>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
            View Terminal
          </button>
        </div>
      </div>
    </div>
  );
}