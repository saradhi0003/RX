/**
 * useDevice.test.jsx — the shell's device adaptation.
 *
 * The app had zero responsive behaviour: no @media rules in Layout.jsx and a
 * nav that only opened on hover, which does not exist on touch. These tests pin
 * the two decisions the layout now depends on — "is this narrow?" and "can this
 * person hover?" — and the fact that they are read from matchMedia rather than
 * sniffed from a user-agent string.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useDevice,
  useIsMobile,
  MOBILE_BREAKPOINT,
  TABLET_BREAKPOINT,
} from "@/hooks/useDevice";

/** Minimal matchMedia stand-in driven by a predicate over the query string. */
function installMatchMedia(matcher) {
  const listeners = new Set();
  const mql = (query) => ({
    matches: matcher(query),
    media: query,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
  });
  window.matchMedia = vi.fn(mql);
  return {
    /** Swap the predicate and fire change, as a resize or rotation would. */
    update(next) {
      matcher = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

/** Predicate for a viewport of a given width with a given pointer type. */
const viewport = (width, { touch = false, standalone = false, portrait = true } = {}) => (q) => {
  if (q.includes("pointer: coarse")) return touch;
  if (q.includes("display-mode: standalone")) return standalone;
  if (q.includes("orientation: portrait")) return portrait;
  if (q.includes("max-width") && q.includes("min-width")) {
    return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
  }
  if (q.includes(`max-width: ${MOBILE_BREAKPOINT - 1}px`)) return width < MOBILE_BREAKPOINT;
  if (q.includes(`min-width: ${TABLET_BREAKPOINT}px`)) return width >= TABLET_BREAKPOINT;
  return false;
};

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  delete navigator.standalone;
});

describe("useDevice", () => {
  it("classifies a phone", () => {
    installMatchMedia(viewport(390, { touch: true }));
    const { result } = renderHook(() => useDevice());
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isTouch).toBe(true);
  });

  it("classifies a tablet", () => {
    installMatchMedia(viewport(820, { touch: true }));
    const { result } = renderHook(() => useDevice());
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it("classifies a desktop", () => {
    installMatchMedia(viewport(1440));
    const { result } = renderHook(() => useDevice());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTouch).toBe(false);
  });

  it("keeps the three size classes mutually exclusive", () => {
    for (const w of [320, 767, 768, 1023, 1024, 1920]) {
      installMatchMedia(viewport(w));
      const { result, unmount } = renderHook(() => useDevice());
      const { isMobile, isTablet, isDesktop } = result.current;
      expect([isMobile, isTablet, isDesktop].filter(Boolean)).toHaveLength(1);
      unmount();
    }
  });

  it("separates touch from width — a touch laptop is desktop-sized but coarse", () => {
    // This is the case width-only detection gets wrong, and it is exactly the
    // one that decides whether hover-to-open nav is usable.
    installMatchMedia(viewport(1440, { touch: true }));
    const { result } = renderHook(() => useDevice());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTouch).toBe(true);
  });

  it("reacts to a viewport change without a remount", () => {
    const mm = installMatchMedia(viewport(1440));
    const { result } = renderHook(() => useDevice());
    expect(result.current.isDesktop).toBe(true);

    mm.update(viewport(390, { touch: true }));
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTouch).toBe(true);
  });

  it("reports orientation and reacts to rotation", () => {
    const mm = installMatchMedia(viewport(390, { touch: true, portrait: true }));
    const { result } = renderHook(() => useDevice());
    expect(result.current.orientation).toBe("portrait");

    mm.update(viewport(844, { touch: true, portrait: false }));
    expect(result.current.orientation).toBe("landscape");
  });

  it("detects an installed PWA via display-mode", () => {
    installMatchMedia(viewport(390, { touch: true, standalone: true }));
    const { result } = renderHook(() => useDevice());
    expect(result.current.isStandalone).toBe(true);
  });

  it("detects an installed PWA on iOS, which predates display-mode", () => {
    installMatchMedia(viewport(390, { touch: true, standalone: false }));
    navigator.standalone = true;
    const { result } = renderHook(() => useDevice());
    expect(result.current.isStandalone).toBe(true);
  });

  it("does not consult the user-agent string", () => {
    // Guards the design decision: UA sniffing is spoofable and answers the
    // wrong question. If someone adds it later, this fails.
    const uaSpy = vi.spyOn(navigator, "userAgent", "get");
    installMatchMedia(viewport(390, { touch: true }));
    renderHook(() => useDevice());
    expect(uaSpy).not.toHaveBeenCalled();
    uaSpy.mockRestore();
  });

  it("degrades to desktop when matchMedia is unavailable", () => {
    // jsdom without the shim, or an SSR pass. Must not throw.
    delete window.matchMedia;
    const { result } = renderHook(() => useDevice());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isTouch).toBe(false);
  });

  it("removes its listeners on unmount", () => {
    const removals = [];
    window.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: (_, fn) => removals.push(fn),
    }));
    const { unmount } = renderHook(() => useDevice());
    unmount();
    expect(removals.length).toBeGreaterThan(0);
  });
});

describe("useIsMobile (back-compat alias)", () => {
  it("agrees with useDevice().isMobile", () => {
    installMatchMedia(viewport(390, { touch: true }));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("is false on desktop", () => {
    installMatchMedia(viewport(1440));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
