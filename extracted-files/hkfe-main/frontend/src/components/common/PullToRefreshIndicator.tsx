import styles from './PullToRefreshIndicator.module.css';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
}

export default function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 5 && !isRefreshing) return null;

  return (
    <div
      className={styles.indicatorWrapper}
      style={{
        transform: `translateY(${Math.min(pullDistance, 70)}px)`,
        opacity: Math.min(pullDistance / 35, 1),
      }}
    >
      <div className={styles.spinnerCircle}>
        {isRefreshing ? (
          <div className={styles.spinnerRing} />
        ) : (
          <span
            className={styles.pullIcon}
            style={{
              transform: `rotate(${Math.min(pullDistance * 3.5, 180)}deg)`,
            }}
          >
            ↓
          </span>
        )}
      </div>
    </div>
  );
}
