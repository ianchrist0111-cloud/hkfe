// HKFES Progressive Web App & Push Notification Manager
// iOS 16.4+ Web Push • Android Chrome • In-App Fallbacks • App Badging

import { useNotificationsStore } from '../store';

export interface PushStatus {
  supported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  iosVersion: number | null;
  permission: NotificationPermission;
  reason?: 'not_standalone_ios' | 'pre_ios_16_4' | 'permission_denied' | 'unsupported_browser';
}

/**
 * Detects iOS device
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Extracts iOS major version from User Agent
 */
export function getIOSMajorVersion(): number | null {
  if (!isIOSDevice()) return null;
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (match && match[1]) {
    return parseFloat(`${match[1]}.${match[2]}`);
  }
  return null;
}

/**
 * Checks if application is running in installed PWA standalone mode
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    (document.referrer.includes('android-app://'))
  );
}

/**
 * Evaluates current platform Web Push readiness & limitations
 */
export function getPushSupportStatus(): PushStatus {
  const isIOS = isIOSDevice();
  const iosVer = getIOSMajorVersion();
  const isStandalone = isPwaStandalone();
  const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasPush = typeof window !== 'undefined' && 'PushManager' in window;
  const hasNotif = typeof window !== 'undefined' && 'Notification' in window;

  const currentPermission: NotificationPermission = hasNotif
    ? Notification.permission
    : 'default';

  // iOS-specific gates
  if (isIOS) {
    if (iosVer !== null && iosVer < 16.4) {
      return {
        supported: false,
        isIOS: true,
        isStandalone,
        iosVersion: iosVer,
        permission: currentPermission,
        reason: 'pre_ios_16_4',
      };
    }
    if (!isStandalone) {
      return {
        supported: false,
        isIOS: true,
        isStandalone: false,
        iosVersion: iosVer,
        permission: currentPermission,
        reason: 'not_standalone_ios',
      };
    }
  }

  // Standard browser feature check
  if (!hasSW || !hasPush || !hasNotif) {
    return {
      supported: false,
      isIOS,
      isStandalone,
      iosVersion: iosVer,
      permission: currentPermission,
      reason: 'unsupported_browser',
    };
  }

  if (currentPermission === 'denied') {
    return {
      supported: true,
      isIOS,
      isStandalone,
      iosVersion: iosVer,
      permission: 'denied',
      reason: 'permission_denied',
    };
  }

  return {
    supported: true,
    isIOS,
    isStandalone,
    iosVersion: iosVer,
    permission: currentPermission,
  };
}

/**
 * Helper to convert standard VAPID base64 key into Uint8Array buffer
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the production service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Check for updates periodically
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New version available.');
          }
        });
      }
    });

    return registration;
  } catch (err) {
    console.warn('[PWA] Service Worker registration note:', err);
    return null;
  }
}

/**
 * Requests push permission and subscribes via PushManager
 */
export async function subscribeToPushNotifications(vapidPublicKey?: string): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
  fallbackUsed?: boolean;
}> {
  const status = getPushSupportStatus();

  // If push isn't natively available, we log reason and use graceful in-app fallback
  if (!status.supported) {
    return {
      success: false,
      fallbackUsed: true,
      error: status.reason || 'Web Push not available on this configuration.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        fallbackUsed: true,
        error: 'Notification permission was denied by user.',
      };
    }

    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      // Default HKFES Demo VAPID public key or custom provided key
      const key =
        vapidPublicKey ||
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }

    // Send subscription to backend if available
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
    } catch {
      // Non-blocking in offline / local demo mode
    }

    return { success: true, subscription };
  } catch (err: any) {
    return { success: false, fallbackUsed: true, error: err.message || 'Push subscription failed.' };
  }
}

import {
  playDepositChime,
  playOrderFillTone,
  playYieldPing,
  playMarginAlert,
} from './soundEffects';
import { NotificationType } from '../store';

/**
 * Dispatches an actionable fintech event with sound synthesis, haptics, store update, and OS push/badging
 */
export function triggerFintechAlert(alert: {
  title: string;
  message: string;
  type?: NotificationType;
  symbol?: string;
  amount?: number;
  deepLink?: string;
  actionText?: string;
  silent?: boolean;
}) {
  const alertType = alert.type || 'system';

  // 1. Play procedural audio tone based on financial action
  if (!alert.silent) {
    if (alertType === 'deposit' || alertType === 'withdrawal') {
      playDepositChime();
    } else if (alertType === 'order_filled') {
      playOrderFillTone();
    } else if (alertType === 'earn_payout' || alertType === 'bot_activity') {
      playYieldPing();
    } else if (alertType === 'margin_warning') {
      playMarginAlert();
    }
  }

  // 2. Trigger tuned mobile haptics
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (alertType === 'margin_warning') {
        navigator.vibrate([100, 50, 100, 50, 150]);
      } else if (alertType === 'deposit' || alertType === 'order_filled') {
        navigator.vibrate([25, 40, 25]);
      } else {
        navigator.vibrate(20);
      }
    }
  } catch {}

  // 3. Add to In-App Zustand store (triggers GlobalNotificationToast automatically)
  useNotificationsStore.getState().addNotification({
    title: alert.title,
    message: alert.message,
    type: alertType,
    symbol: alert.symbol,
    amount: alert.amount,
    deepLink: alert.deepLink,
    actionText: alert.actionText,
  });

  // 4. Update OS native app badge
  const count = useNotificationsStore.getState().unreadCount;
  updateAppBadge(count);
}

/**
 * Updates application icon badge (iOS 16.4+ standalone & Android)
 */
export function updateAppBadge(count: number) {
  if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  // Also post message to service worker
  if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_BADGE',
      count,
    });
  }
}
