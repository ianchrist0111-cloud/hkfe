import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationsStore, NotificationType } from '../../store';
import styles from './GlobalNotificationToast.module.css';

function getToastIcon(type: NotificationType): string {
  switch (type) {
    case 'deposit':
      return '💰';
    case 'withdrawal':
      return '💸';
    case 'order_filled':
      return '⚡';
    case 'margin_warning':
      return '⚠️';
    case 'earn_payout':
    case 'bot_activity':
      return '🤖';
    case 'security':
      return '🔒';
    case 'price_alert':
      return '📈';
    case 'system':
    default:
      return '🔔';
  }
}

function getGlowClass(type: NotificationType): string {
  switch (type) {
    case 'deposit':
    case 'withdrawal':
      return styles.glowDeposit;
    case 'order_filled':
      return styles.glowOrder;
    case 'margin_warning':
      return styles.glowMargin;
    case 'earn_payout':
    case 'bot_activity':
      return styles.glowYield;
    default:
      return '';
  }
}

export default function GlobalNotificationToast() {
  const navigate = useNavigate();
  const activeToast = useNotificationsStore(s => s.activeToast);
  const dismissToast = useNotificationsStore(s => s.dismissToast);
  const markRead = useNotificationsStore(s => s.markRead);

  useEffect(() => {
    if (!activeToast) return;

    // Auto dismiss after 5.5s
    const timer = setTimeout(() => {
      dismissToast();
    }, 5500);

    return () => clearTimeout(timer);
  }, [activeToast?.id, dismissToast]);

  if (!activeToast) return null;

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    markRead(activeToast.id);
    dismissToast();
    if (activeToast.deepLink) {
      navigate(activeToast.deepLink);
    } else {
      navigate('/notifications');
    }
  };

  const handleCardClick = () => {
    markRead(activeToast.id);
    dismissToast();
    if (activeToast.deepLink) {
      navigate(activeToast.deepLink);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className={styles.toastWrapper}>
      <div
        className={`${styles.toastCard} ${getGlowClass(activeToast.type)}`}
        onClick={handleCardClick}
      >
        <div className={styles.toastIconWrap}>
          {getToastIcon(activeToast.type)}
        </div>

        <div className={styles.toastBody}>
          <div className={styles.toastHeader}>
            <span className={styles.toastTitle}>{activeToast.title}</span>
            <span className={styles.toastTime}>Just now</span>
          </div>
          <p className={styles.toastMessage}>{activeToast.message}</p>
        </div>

        {activeToast.deepLink && (
          <button className={styles.toastActionBtn} onClick={handleAction}>
            {activeToast.actionText || 'View'}
          </button>
        )}

        <button
          className={styles.toastCloseBtn}
          onClick={(e) => {
            e.stopPropagation();
            dismissToast();
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
