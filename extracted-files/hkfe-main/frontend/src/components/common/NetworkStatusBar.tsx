import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useWalletStore, usePriceStore } from '../../store';
import styles from './NetworkStatusBar.module.css';

export default function NetworkStatusBar() {
  const { isOnline, reconnectedJustNow } = useNetworkStatus();
  const fetchWallet = useWalletStore(s => s.fetchWallet);

  // If online and not just reconnected, don't show the bar
  if (isOnline && !reconnectedJustNow) {
    return null;
  }

  const handleManualRefresh = () => {
    fetchWallet();
  };

  return (
    <div className={styles.statusContainer} role="status" aria-live="polite">
      {!isOnline ? (
        <div className={`${styles.pill} ${styles.pillOffline}`}>
          <span className={styles.pulsingDot} />
          <span>📡 Offline Mode — Viewing Cached Data</span>
          <button className={styles.refreshBtn} onClick={handleManualRefresh}>
            Retry
          </button>
        </div>
      ) : (
        <div className={`${styles.pill} ${styles.pillReconnected}`}>
          <span className={styles.pulsingDot} />
          <span>⚡ Connection Restored — Live Feeds Synced</span>
        </div>
      )}
    </div>
  );
}
