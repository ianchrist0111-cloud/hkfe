import { useState, useEffect, useRef } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 60,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const isDragging = useRef(false);
  const reachedThreshold = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const scrollableParent = target.closest('.content') || document.documentElement;

      // Only initiate pull when at the very top of the page
      if (scrollableParent.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        isDragging.current = true;
        reachedThreshold.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || startY.current === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const rawDistance = currentY - startY.current;

      if (rawDistance > 0) {
        // Apply friction to pull distance
        const distance = Math.min(rawDistance * 0.45, 90);
        setPullDistance(distance);

        // Haptic feedback when threshold is reached
        if (distance >= threshold && !reachedThreshold.current) {
          reachedThreshold.current = true;
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(12);
            }
          } catch {}
        } else if (distance < threshold) {
          reachedThreshold.current = false;
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);

        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
          startY.current = null;
        }
      } else {
        setPullDistance(0);
        startY.current = null;
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, threshold, onRefresh, pullDistance, isRefreshing]);

  return { pullDistance, isRefreshing };
}
