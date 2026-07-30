/**
 * Idle sign-out — the session lifetime Supabase will not enforce for you.
 *
 * `autoRefreshToken: true` (see src/lib/supabase.js) renews the JWT indefinitely as
 * long as a tab is open, so an abandoned laptop on a recruiter's desk keeps a
 * live CRM session — full candidate PII — until someone closes the browser.
 * This hook signs the user out after IDLE_LOGOUT_MS without activity.
 *
 * Ported from FinTracker's `app/lib/useIdleLogout.ts` (React Native) to plain
 * React DOM. See skills/mfa-totp/ for the pattern this belongs to.
 *
 * Two independent racers decide expiry, because neither alone is sufficient:
 *   1. a 30s interval — catches an idle but *visible* tab;
 *   2. a visibilitychange re-check — mobile browsers freeze timers while
 *      backgrounded, so the interval simply does not run there.
 *
 * The last-activity clock is persisted to localStorage rather than held in
 * memory. Without that, closing the tab reset the clock: a phone browser evicts
 * background tabs constantly, so every restore looked like fresh activity and
 * the session effectively never expired.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/** Idle window before the session is terminated. */
export const IDLE_LOGOUT_MS = 20 * 60 * 1000;

/** Persisted last-activity stamp — survives a reload or a closed tab. */
const STAMP_KEY = "rx_last_activity";

/** Don't hit localStorage on every mousemove. */
const STAMP_THROTTLE_MS = 15_000;

/** Read by Login.jsx to explain the sign-out instead of silently bouncing. */
export const IDLE_NOTICE_KEY = "rx_idle_signout";

const DOM_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"];

// Safari private mode throws on localStorage access. A storage failure must
// never sign a user out or break a render, so every access is swallowed.
function readStamp() {
  try {
    const raw = window.localStorage.getItem(STAMP_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStamp(at) {
  try {
    window.localStorage.setItem(STAMP_KEY, String(at));
  } catch {
    /* storage unavailable — fall back to the in-memory clock */
  }
}

function clearStamp() {
  try {
    window.localStorage.removeItem(STAMP_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * @param {boolean} enabled - true while a session is live (drives arm/disarm).
 * @param {Function} [onTimeout] - optional side effect to run after the sign-out.
 */
export function useIdleLogout(enabled, onTimeout) {
  const last = useRef(Date.now());
  const written = useRef(0);
  const fired = useRef(false);
  const wasEnabled = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  // Keep the callback current without re-arming the listeners every render.
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) {
      // Drop the clock on a real sign-out so the next login starts fresh — but
      // NOT on first paint, where the session simply hasn't been restored yet
      // and the stored stamp is exactly what we still need to read.
      if (wasEnabled.current) clearStamp();
      wasEnabled.current = false;
      return;
    }
    wasEnabled.current = true;
    fired.current = false;

    const expire = () => {
      if (fired.current) return; // the interval and visibilitychange can race
      fired.current = true;
      clearStamp();
      try {
        window.sessionStorage.setItem(IDLE_NOTICE_KEY, "1");
      } catch {
        /* the notice is cosmetic; the sign-out below is the control */
      }
      // Not awaited: the auth state change drives the redirect, and a network
      // failure here must not leave the app sitting in a signed-in shell.
      supabase.auth.signOut();
      onTimeoutRef.current?.();
    };

    // A restored session inherits the stored clock: if the tab was closed (or
    // the phone asleep) longer than the window, that idle time still counts.
    const restored = readStamp();
    if (restored != null && Date.now() - restored > IDLE_LOGOUT_MS) {
      expire();
      return;
    }

    last.current = Date.now(); // opening the app is itself activity
    written.current = last.current;
    writeStamp(last.current);

    const touch = () => {
      last.current = Date.now();
      if (last.current - written.current >= STAMP_THROTTLE_MS) {
        written.current = last.current;
        writeStamp(last.current);
      }
    };

    const check = () => {
      if (fired.current) return;
      // Another tab may hold a fresher timestamp — trust the newest one, or
      // working in tab B would sign you out of tab A.
      const stored = readStamp();
      const at = stored != null && stored > last.current ? stored : last.current;
      if (Date.now() - at > IDLE_LOGOUT_MS) expire();
    };

    DOM_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    // Flush the exact stamp when the tab is hidden or torn down, and re-check on
    // the way back — the interval below cannot be trusted to have run while the
    // tab was backgrounded.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        written.current = last.current;
        writeStamp(last.current);
      } else {
        check();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);

    const timer = setInterval(check, 30_000);

    return () => {
      clearInterval(timer);
      DOM_EVENTS.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, [enabled]);
}

/**
 * True once if this page load followed an idle sign-out. Consumes the flag so
 * the notice shows on the login screen and not on every subsequent render.
 */
export function consumeIdleNotice() {
  try {
    const hit = window.sessionStorage.getItem(IDLE_NOTICE_KEY) === "1";
    if (hit) window.sessionStorage.removeItem(IDLE_NOTICE_KEY);
    return hit;
  } catch {
    return false;
  }
}
