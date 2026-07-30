import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

/** Inactivity before the app re-locks. Matches the web idle-logout window. */
export const LOCK_AFTER_MS = 20 * 60 * 1000;

/**
 * Mobile privacy lock.
 *
 * The web app signs you out after 20 minutes idle (src/hooks/useIdleLogout.js).
 * That policy is wrong for a phone: re-typing a password and a TOTP code every
 * time you pocket the device makes the app unusable, so mobile keeps the
 * Supabase session and instead re-locks the UI behind device biometrics.
 *
 * The session (and AAL2, and RLS) remain the real security boundary — this is a
 * shoulder-surfing gate over a device that is already trusted.
 *
 * Locks on: first appearance of a session, backgrounding, and inactivity.
 */
export function useAppLock(enabled: boolean) {
  const isNative = Platform.OS !== 'web';
  const active = isNative && enabled;
  const [locked, setLocked] = useState(active);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLocked(true), LOCK_AFTER_MS);
  }, []);

  /** Any touch (fed from the root view) pushes back the inactivity re-lock. */
  const touch = useCallback(() => {
    if (active) arm();
  }, [active, arm]);

  useEffect(() => {
    if (!active) {
      setLocked(false);
      return;
    }
    setLocked(true); // require an unlock whenever a session (re)appears
    arm();
    const sub = AppState.addEventListener('change', (s) => {
      // 'inactive' covers the iOS app-switcher preview, where the snapshot the
      // OS takes would otherwise show candidate data.
      if (s === 'background' || s === 'inactive') setLocked(true);
      else if (s === 'active') arm();
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      sub.remove();
    };
  }, [active, arm]);

  return { locked, unlock: useCallback(() => setLocked(false), []), touch };
}
