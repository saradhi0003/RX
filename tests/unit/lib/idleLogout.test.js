// Idle sign-out. The interesting behaviour is the PERSISTED clock: a session
// restored after the tab was closed for longer than the window must expire
// immediately, which an in-memory timer alone can never notice.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const signOut = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signOut } } }));

const { useIdleLogout, IDLE_LOGOUT_MS, consumeIdleNotice } =
  await import("@/hooks/useIdleLogout");

const STAMP_KEY = "rx_last_activity";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIdleLogout()", () => {
  it("signs out immediately when the restored clock is already stale", () => {
    // The tab was closed for longer than the idle window — that time counts.
    window.localStorage.setItem(STAMP_KEY, String(Date.now() - IDLE_LOGOUT_MS - 1000));

    renderHook(() => useIdleLogout(true));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("leaves a freshly-stamped session alone", () => {
    window.localStorage.setItem(STAMP_KEY, String(Date.now() - 1000));

    renderHook(() => useIdleLogout(true));

    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out once the window elapses with no activity", () => {
    renderHook(() => useIdleLogout(true));
    expect(signOut).not.toHaveBeenCalled();

    vi.advanceTimersByTime(IDLE_LOGOUT_MS + 30_000);

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("only fires once even though the interval keeps ticking", () => {
    renderHook(() => useIdleLogout(true));

    vi.advanceTimersByTime(IDLE_LOGOUT_MS * 3);

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("treats activity as a reprieve", () => {
    renderHook(() => useIdleLogout(true));

    // Just short of the deadline, then a keypress, then almost as long again.
    vi.advanceTimersByTime(IDLE_LOGOUT_MS - 60_000);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(IDLE_LOGOUT_MS - 60_000);

    expect(signOut).not.toHaveBeenCalled();
  });

  it("does nothing at all while there is no session", () => {
    renderHook(() => useIdleLogout(false));

    vi.advanceTimersByTime(IDLE_LOGOUT_MS * 2);

    expect(signOut).not.toHaveBeenCalled();
  });

  it("does not clear a stored stamp on first paint, before the session resolves", () => {
    // The stamp is exactly what a restoring session still needs to read.
    const stamp = String(Date.now() - 1000);
    window.localStorage.setItem(STAMP_KEY, stamp);

    renderHook(() => useIdleLogout(false));

    expect(window.localStorage.getItem(STAMP_KEY)).toBe(stamp);
  });

  it("drops the stamp on a real sign-out so the next login starts fresh", () => {
    const { rerender } = renderHook(({ on }) => useIdleLogout(on), {
      initialProps: { on: true },
    });
    expect(window.localStorage.getItem(STAMP_KEY)).not.toBeNull();

    rerender({ on: false });

    expect(window.localStorage.getItem(STAMP_KEY)).toBeNull();
  });
});

describe("consumeIdleNotice()", () => {
  it("reports an idle sign-out exactly once", () => {
    window.localStorage.setItem(STAMP_KEY, String(Date.now() - IDLE_LOGOUT_MS - 1000));
    renderHook(() => useIdleLogout(true));

    expect(consumeIdleNotice()).toBe(true);
    expect(consumeIdleNotice()).toBe(false); // consumed
  });

  it("reports nothing on an ordinary visit to the login page", () => {
    expect(consumeIdleNotice()).toBe(false);
  });
});
