import { useState, useEffect } from 'react';
import { usePwaInstall } from '../../lib/pwaInstall';
import styles from './PwaAutoInstallPrompt.module.css';

export default function PwaAutoInstallPrompt() {
  const { canInstall, isStandalone, isInstalled, isIOS, isDismissed, install, dismiss, hasPrompt } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // If already installed, running standalone, or dismissed, do not show
    if (isStandalone || isInstalled || isDismissed) {
      setVisible(false);
      return;
    }

    // Only show if can install (prompt available or iOS)
    if (canInstall) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [canInstall, isStandalone, isInstalled, isDismissed]);

  if (!visible || isStandalone || isInstalled || isDismissed) {
    return null;
  }

  const handleInstall = async () => {
    if (isIOS) {
      setShowIosGuide(prev => !prev);
      return;
    }

    setInstalling(true);
    try {
      const outcome = await install();
      if (outcome === 'accepted') {
        setVisible(false);
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    dismiss(72); // 3-day cooldown
  };

  return (
    <div className={styles.floatingContainer} role="dialog" aria-label="Install HKFES App">
      <div className={styles.card}>
        <button
          className={styles.closeBtn}
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
        >
          ✕
        </button>

        <div className={styles.topRow}>
          <div className={styles.appIconWrap}>
            <span>HK</span>
          </div>
          <div className={styles.titleArea}>
            <div className={styles.titleRow}>
              <h4 className={styles.title}>Install HKFES App</h4>
              <span className={styles.badge}>WebAPK</span>
            </div>
            <p className={styles.subtitle}>Sub-millisecond trading & instant price alerts</p>
          </div>
        </div>

        <div className={styles.perksRow}>
          <span className={styles.perkPill}>⚡ Fullscreen Trading</span>
          <span className={styles.perkPill}>🔔 Native Push Alerts</span>
          <span className={styles.perkPill}>🚀 0 MB Store Download</span>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.installBtn}
            onClick={handleInstall}
            disabled={installing}
          >
            {installing
              ? 'Installing…'
              : isIOS
              ? 'Add to Home Screen 📲'
              : '⚡ Install HKFES App (1-Click)'}
          </button>
          <button className={styles.dismissBtn} onClick={handleDismiss}>
            Not Now
          </button>
        </div>

        {isIOS && showIosGuide && (
          <div className={styles.iosGuide}>
            <div className={styles.iosStep}>
              <span className={styles.iosStepNum}>1</span>
              <span>Tap the <strong>Share</strong> icon (⎋) in Safari's bottom bar.</span>
            </div>
            <div className={styles.iosStep}>
              <span className={styles.iosStepNum}>2</span>
              <span>Scroll down & tap <strong>"Add to Home Screen"</strong> (⊞).</span>
            </div>
            <div className={styles.iosStep}>
              <span className={styles.iosStepNum}>3</span>
              <span>Tap <strong>Add</strong> in top-right to launch standalone HKFES.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
