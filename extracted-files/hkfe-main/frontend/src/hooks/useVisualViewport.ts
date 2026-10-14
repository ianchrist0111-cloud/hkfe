import { useEffect, useState } from 'react';

/**
 * useVisualViewport — Tracks iOS Safari virtual keyboard height and visual viewport shifts.
 * Automatically synchronizes `--keyboard-offset` on :root for fluid CSS adaptation.
 */
export function useVisualViewport() {
  const [keyboardOffset, setKeyboardOffset] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const vv = window.visualViewport;

    const updateViewport = () => {
      // Offset between window inner height and active visual viewport (minus scroll offset if any)
      const offset = Math.max(0, window.innerHeight - vv.height);
      // Threshold > 60px to avoid false positives from browser bar collapse
      const activeKeyboard = offset > 60 ? offset : 0;
      setKeyboardOffset(activeKeyboard);
      document.documentElement.style.setProperty('--keyboard-offset', `${activeKeyboard}px`);
    };

    vv.addEventListener('resize', updateViewport);
    vv.addEventListener('scroll', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    updateViewport();

    return () => {
      vv.removeEventListener('resize', updateViewport);
      vv.removeEventListener('scroll', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      document.documentElement.style.setProperty('--keyboard-offset', '0px');
    };
  }, []);

  return keyboardOffset;
}
