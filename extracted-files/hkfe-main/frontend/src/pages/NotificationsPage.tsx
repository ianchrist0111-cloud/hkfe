import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationsStore, NotificationType } from '../store';
import { triggerFintechAlert } from '../lib/pushNotifications';
import { IconBell } from '../components/common/Icons';
import styles from './NotificationsPage.module.css';

type FilterCategory = 'all' | 'trade' | 'wallet' | 'earn' | 'security';

function getNotificationEmoji(type: NotificationType): string {
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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markRead, markAllRead, clearAll } = useNotificationsStore();
  const [filter, setFilter] = useState<FilterCategory>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'trade') return n.type === 'order_filled' || n.type === 'price_alert';
    if (filter === 'wallet') return n.type === 'deposit' || n.type === 'withdrawal';
    if (filter === 'earn') return n.type === 'earn_payout' || n.type === 'bot_activity';
    if (filter === 'security') return n.type === 'security' || n.type === 'margin_warning';
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Financial Notification Center</h1>
          <p className={styles.headerSub}>
            Real-time execution tickets, margin risk alarms, bot yield compounding, and blockchain confirmations.
          </p>
        </div>
        <div className={styles.headerActions}>
          {notifications.some((n) => !n.read) && (
            <button className={styles.markAll} onClick={markAllRead}>
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className={styles.markAll}
              style={{ color: 'var(--text-muted)' }}
              onClick={clearAll}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Tabs with Horizontal Fade Edge ── */}
      <div className="fadeEdgeTrack" style={{ padding: '4px 0', margin: '0 0 var(--space-2)' }}>
        {(
          [
            { id: 'all', label: 'All Alerts' },
            { id: 'trade', label: 'Trading & Fills' },
            { id: 'wallet', label: 'Wallet & Deposits' },
            { id: 'earn', label: 'Bots & Yield' },
            { id: 'security', label: 'Margin & Security' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`filterPill ${filter === tab.id ? 'filterPillActive' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Test Sound & Push Sandbox Strip (Collapsed / Compact) ── */}
      <div className={styles.sandboxCard}>
        <span className={styles.sandboxLabel}>⚡ Test Audio Chimes & Native Push:</span>
        <div className={styles.sandboxBtns}>
          <button
            className={styles.sandboxBtn}
            onClick={() =>
              triggerFintechAlert({
                title: 'Deposit Confirmed: 2,500 USDT 💰',
                message: '12 block confirmations reached on TRC20 network. Ready to trade.',
                type: 'deposit',
                deepLink: '/wallet',
                actionText: 'View Wallet',
              })
            }
          >
            💰 Deposit Chime
          </button>
          <button
            className={styles.sandboxBtn}
            onClick={() =>
              triggerFintechAlert({
                title: 'Order Executed: BUY 0.25 BTC ⚡',
                message: 'Filled at $64,120.00 USD. Position opened with 10x leverage.',
                type: 'order_filled',
                symbol: 'BTC/USD',
                deepLink: '/trade/BTC/USD',
                actionText: 'View Position',
              })
            }
          >
            ⚡ Order Fill Tone
          </button>
          <button
            className={styles.sandboxBtn}
            onClick={() =>
              triggerFintechAlert({
                title: 'Bot Yield Accrual: +$18.40 🤖',
                message: 'USDT Grid Arbitrage Bot compounded daily payout to cash balance.',
                type: 'bot_activity',
                deepLink: '/services',
                actionText: 'View Vault',
              })
            }
          >
            🤖 Yield Bell
          </button>
          <button
            className={styles.sandboxBtn}
            style={{ color: 'var(--color-loss)' }}
            onClick={() =>
              triggerFintechAlert({
                title: 'Margin Warning: Equity at 112% ⚠️',
                message: 'Account margin buffer approaching liquidation threshold. Add collateral.',
                type: 'margin_warning',
                deepLink: '/wallet/deposit',
                actionText: 'Deposit Now',
              })
            }
          >
            ⚠️ Margin Alarm
          </button>
        </div>
      </div>

      {/* ── Notification Feed ── */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIconWrap}>
            <IconBell size={36} color="var(--text-muted)" />
          </div>
          <p>No notifications found in this category.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`${styles.item} ${!n.read ? styles.unread : ''}`}
              onClick={() => markRead(n.id)}
            >
              <div className={styles.icon}>{getNotificationEmoji(n.type)}</div>
              <div className={styles.content}>
                <div className={styles.titleRow}>
                  <strong>{n.title}</strong>
                  <span className={styles.timeTag}>
                    {new Date(n.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p>{n.message}</p>
                {n.deepLink && (
                  <div className={styles.actionRow}>
                    <button
                      className={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(n.id);
                        navigate(n.deepLink!);
                      }}
                    >
                      {n.actionText || 'View Details'} →
                    </button>
                  </div>
                )}
              </div>
              {!n.read && <div className={styles.dot} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}