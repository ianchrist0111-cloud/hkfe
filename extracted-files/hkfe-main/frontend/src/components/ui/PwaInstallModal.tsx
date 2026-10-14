import { useState, useEffect } from 'react';
import {
  isIOSDevice,
  isPwaStandalone,
  getPushSupportStatus,
  subscribeToPushNotifications,
  triggerFintechAlert,
  PushStatus,
} from '../../lib/pushNotifications';
import { usePwaInstall } from '../../lib/pwaInstall';
import styles from './PwaInstallModal.module.css';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PwaInstallModal({ isOpen, onClose }: PwaInstallModalProps) {
  const { hasPrompt, install } = usePwaInstall();
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    // Initial status check
    const status = getPushSupportStatus();
    setPushStatus(status);
    setPushSubscribed(status.permission === 'granted');
  }, [isOpen]);

  if (!isOpen) return null;

  const isIOS = isIOSDevice();
  const isStandalone = isPwaStandalone();

  const handleInstallClick = async () => {
    const outcome = await install();
    if (outcome === 'accepted') {
      onClose();
    }
  };

  const handleEnablePush = async () => {
    setSubscribing(true);
    try {
      const result = await subscribeToPushNotifications();
      if (result.success || result.subscription) {
        setPushSubscribed(true);
        triggerFintechAlert({
          title: 'Push Alerts Enabled ✅',
          message: 'You will now receive real-time execution, margin, and deposit updates.',
          type: 'system',
        });
      }
    } finally {
      setSubscribing(false);
      setPushStatus(getPushSupportStatus());
    }
  };

  const handleSendTestPush = () => {
    setTestSent(true);
    triggerFintechAlert({
      title: 'Deposit Confirmed: 5,000 USDT ⚡',
      message: 'Network confirmations reached (TRC20). Balance updated in Trading Terminal.',
      type: 'system',
      symbol: 'USDT',
    });
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className={styles.header}>
          <div className={styles.appIcon}>HK</div>
          <div className={styles.headerText}>
            <h3>HKFES Native App</h3>
            <p>Sub-millisecond execution & push notification alerts</p>
          </div>
        </div>

        {/* ── ALREADY INSTALLED STANDALONE VIEW ── */}
        {isStandalone ? (
          <div>
            <div className={styles.installedNote}>
              <span className={styles.badgeSuccess}>✓ Running in Native Standalone Mode</span>
              <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Full-screen hardware acceleration and Dynamic Island safe-area support active.
              </p>
            </div>

            <div className={styles.pushSection}>
              <div className={styles.pushTitleRow}>
                <h4>Push Notifications</h4>
                <span
                  className={`${styles.pushStatusBadge} ${
                    pushSubscribed ? 'badge-gain' : 'badge-medium'
                  }`}
                >
                  {pushSubscribed ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p className={styles.pushDesc}>
                Receive immediate push pings when limit orders fill, bot yield accrues, or margin warnings occur.
              </p>

              <div className={styles.actionsGrid}>
                {!pushSubscribed ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleEnablePush}
                    disabled={subscribing}
                  >
                    {subscribing ? 'Enabling…' : 'Enable Web Push 🔔'}
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleSendTestPush}
                  >
                    {testSent ? 'Ping Dispatched!' : 'Test Push Alert ⚡'}
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={handleSendTestPush}>
                  Simulate Fill Tone 🎯
                </button>
              </div>
            </div>
          </div>
        ) : isIOS ? (
          /* ── iOS SAFARI COACHMARK WALKTHROUGH ── */
          <div>
            <div className={styles.iosNotice}>
              <span>ℹ️</span>
              <span>
                Apple requires installing to your Home Screen to unlock OS Web Push alerts and remove Safari browser bars.
              </span>
            </div>

            <div className={styles.instructions}>
              <div className={styles.step}>
                <span className={styles.stepNum}>1</span>
                <div>
                  <strong>Tap the Safari Share Icon</strong>
                  <p>
                    Tap the <strong>Share</strong> button (the square with an arrow pointing up ⎋) in the bottom toolbar of Safari.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>2</span>
                <div>
                  <strong>Select "Add to Home Screen"</strong>
                  <p>
                    Scroll down the sharing sheet and select <strong>"Add to Home Screen"</strong> ⊞.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>3</span>
                <div>
                  <strong>Tap "Add" in Top Right</strong>
                  <p>
                    Confirm installation. Launch HKFES directly from your home screen for full standalone trading.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── ANDROID / CHROME INSTALL VIEW ── */
          <div className={styles.chromeSection}>
            <p className={styles.desc}>
              Install the HKFES Progressive Web App for instant access, background synchronization, offline charts, and native push notifications.
            </p>

            {hasPrompt ? (
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', marginBottom: '1rem', fontWeight: 800 }}
                onClick={handleInstallClick}
              >
                ⚡ Install HKFES App (1-Click)
              </button>
            ) : (
              <div className={styles.instructions}>
                <div className={styles.step}>
                  <span className={styles.stepNum}>1</span>
                  <div>
                    <strong>Open Browser Menu</strong>
                    <p>Tap the <strong>three dots (⋮)</strong> in the top-right corner of Chrome.</p>
                  </div>
                </div>
                <div className={styles.step}>
                  <span className={styles.stepNum}>2</span>
                  <div>
                    <strong>Install App</strong>
                    <p>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
