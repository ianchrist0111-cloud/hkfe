/**
 * HKFES PWA Install Manager
 * Captures `beforeinstallprompt` globally on app startup,
 * tracks installation state, and provides 1-click native install triggers.
 */

import { useState, useEffect } from 'react';
import { isIOSDevice, isPwaStandalone } from './pushNotifications';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaInstallState {
  canInstall: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isDismissed: boolean;
}

const DISMISS_STORAGE_KEY = 'hkfes_pwa_prompt_dismissed_until';
const INSTALLED_STORAGE_KEY = 'hkfes_pwa_installed';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const stateListeners = new Set<(state: PwaInstallState) => void>();

function checkIsDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const dismissedUntil = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!dismissedUntil) return false;
    const expiry = parseInt(dismissedUntil, 10);
    return Date.now() < expiry;
  } catch {
    return false;
  }
}

function checkIsInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (isPwaStandalone()) return true;
  try {
    return localStorage.getItem(INSTALLED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function getPwaState(): PwaInstallState {
  const isStandalone = isPwaStandalone();
  const isInstalled = checkIsInstalled();
  const isIOS = isIOSDevice();
  const isDismissed = checkIsDismissed();
  const canInstall = !isStandalone && !isInstalled && (!!deferredPrompt || isIOS);

  return {
    canInstall,
    isStandalone,
    isInstalled,
    isIOS,
    isDismissed,
  };
}

function notifyListeners() {
  const state = getPwaState();
  stateListeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      console.error('[PWA Manager] Listener error:', err);
    }
  });
}

// Initialize global listeners immediately on load
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent default mini-infobar on mobile Chrome
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA Manager] beforeinstallprompt captured successfully.');
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA Manager] App installed event received.');
    deferredPrompt = null;
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
    } catch {}
    notifyListeners();
  });

  // Check display-mode changes (e.g., opened in standalone window)
  window.matchMedia?.('(display-mode: standalone)').addEventListener('change', () => {
    notifyListeners();
  });
}

/**
 * Triggers the browser's 1-click install prompt dialog (Android Chrome / Edge / Desktop Chrome)
 */
export async function triggerPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    console.warn('[PWA Manager] No deferredPrompt available to trigger.');
    return 'unavailable';
  }

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    console.log('[PWA Manager] User choice outcome:', choice.outcome);

    if (choice.outcome === 'accepted') {
      try {
        localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
      } catch {}
      deferredPrompt = null;
      notifyListeners();
    }

    return choice.outcome;
  } catch (err) {
    console.error('[PWA Manager] Error during prompt execution:', err);
    return 'unavailable';
  }
}

/**
 * Dismisses the install prompt for a cooldown period (default: 3 days)
 */
export function dismissPwaPrompt(hours: number = 72) {
  try {
    const expireTime = Date.now() + hours * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_STORAGE_KEY, expireTime.toString());
  } catch {}
  notifyListeners();
}

/**
 * React hook for consuming PWA installation state and trigger functions
 */
export function usePwaInstall() {
  const [state, setState] = useState<PwaInstallState>(getPwaState);

  useEffect(() => {
    const update = (newState: PwaInstallState) => setState(newState);
    stateListeners.add(update);
    // Sync initial state on mount
    setState(getPwaState());
    return () => {
      stateListeners.delete(update);
    };
  }, []);

  return {
    ...state,
    install: triggerPwaInstall,
    dismiss: dismissPwaPrompt,
    hasPrompt: !!deferredPrompt,
  };
}
