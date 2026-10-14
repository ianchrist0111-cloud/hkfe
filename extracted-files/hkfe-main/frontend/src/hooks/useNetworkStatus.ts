import { useState, useEffect } from 'react';

export interface NetworkState {
  isOnline: boolean;
  wasOffline: boolean;
  reconnectedJustNow: boolean;
}

export function useNetworkStatus(): NetworkState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [reconnectedJustNow, setReconnectedJustNow] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setReconnectedJustNow(true);
        const timer = setTimeout(() => {
          setReconnectedJustNow(false);
          setWasOffline(false);
        }, 3500);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setReconnectedJustNow(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline, reconnectedJustNow };
}
