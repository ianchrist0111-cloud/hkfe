import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store';
import {
  checkBiometricSupport,
  verifyBiometrics,
  isBiometricEnrolled,
} from '../../lib/biometrics';
import styles from './BiometricLockModal.module.css';

interface BiometricLockModalProps {
  isOpen: boolean;
  onUnlocked: () => void;
}

export default function BiometricLockModal({ isOpen, onUnlocked }: BiometricLockModalProps) {
  const user = useAuthStore(s => s.user);
  const [biometricType, setBiometricType] = useState<string>('Face ID / Touch ID');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    checkBiometricSupport().then(res => {
      if (res.type === 'face_id') setBiometricType('Face ID');
      else if (res.type === 'touch_id') setBiometricType('Touch ID');
      else if (res.type === 'fingerprint') setBiometricType('Fingerprint');
    });
  }, []);

  if (!isOpen) return null;

  const handleTriggerAuth = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyBiometrics();
      if (res.success) {
        onUnlocked();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const getIcon = () => {
    if (biometricType === 'Face ID') return '👤';
    return '👆';
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.biometricIconWrap} onClick={handleTriggerAuth}>
          {getIcon()}
        </div>

        <div>
          <h2>Terminal Locked</h2>
          <p>Institutional security barrier active. Confirm your identity to resume trading.</p>
        </div>

        {user && (
          <div className={styles.userPill}>
            <span>👤</span>
            <span>{user.firstName} {user.lastName || ''} ({user.email})</span>
          </div>
        )}

        <button
          className={styles.unlockBtn}
          onClick={handleTriggerAuth}
          disabled={isVerifying}
        >
          {isVerifying ? 'Scanning…' : `Unlock with ${biometricType} ⚡`}
        </button>

        <button className={styles.bypassBtn} onClick={onUnlocked}>
          Skip / Unlock with PIN
        </button>
      </div>
    </div>
  );
}
