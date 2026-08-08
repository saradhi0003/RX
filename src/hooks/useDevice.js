import * as React from "react";

/**
 * useDevice — one source of truth for "what kind of device is this?".
 *
 * WHY THIS EXISTS
 * The app shell had no responsive behaviour at all: zero `@media` rules in
 * Layout.jsx, and navigation driven entirely by `onMouseEnter`/`onMouseLeave`
 * on a 56px icon rail. Hover does not exist on touch, so the nav flyout was
 * effectively unopenable on a phone — while the app ships an installable PWA
 * manifest, which invites exactly that.
 *
 * NO USER-AGENT SNIFFING. UA strings are spoofed, truncated and lied about, and
 * they answer the wrong question anyway. What the layout actually needs to know
 * is "can this person hover?" and "how wide is the viewport?" — which is what
 * `matchMedia` reports, accurately, including when the user resizes a window or
 * switches an iPad between mouse and touch mid-session.
 *
 * Breakpoints match Tailwind's `md` (768) and `lg` (1024) so JS decisions and
 * CSS decisions agree.
 */

export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

const QUERIES = {
  isMobile: `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
  isTablet: `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
  isDesktop: `(min-width: ${TABLET_BREAKPOINT}px)`,
  // Coarse pointer = finger/stylus. This, not width, is what decides whether a
  // hover-to-open interaction is usable — a 1024px tablet is still touch.
  isTouch: "(pointer: coarse)",
  // True in an installed PWA. Used for safe-area padding and to hide chrome
  // that only makes sense in a browser tab.
  isStandalone: "(display-mode: standalone)",
  isPortrait: "(orientation: portrait)",
};

/** SSR/jsdom-safe read of a single media query. */
function readQuery(query) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

function readAll() {
  const isMobile = readQuery(QUERIES.isMobile);
  const isTablet = readQuery(QUERIES.isTablet);
  return {
    isMobile,
    isTablet,
    // Derived rather than read, so the three are guaranteed mutually exclusive
    // even if a browser reports overlapping matches at an exact breakpoint.
    isDesktop: !isMobile && !isTablet,
    isTouch: readQuery(QUERIES.isTouch),
    isStandalone:
      readQuery(QUERIES.isStandalone) ||
      // iOS Safari predates display-mode and uses this instead. Non-standard,
      // so it is not on the Navigator type — hence the cast.
      (typeof navigator !== "undefined" &&
        /** @type {any} */ (navigator).standalone === true),
    orientation: /** @type {"portrait"|"landscape"} */ (
      readQuery(QUERIES.isPortrait) ? "portrait" : "landscape"
    ),
  };
}

/**
 * @returns {{isMobile:boolean, isTablet:boolean, isDesktop:boolean,
 *            isTouch:boolean, isStandalone:boolean,
 *            orientation:"portrait"|"landscape"}}
 */
export function useDevice() {
  const [device, setDevice] = React.useState(readAll);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const lists = Object.values(QUERIES).map((q) => window.matchMedia(q));
    const onChange = () => setDevice(readAll());

    lists.forEach((mql) => {
      // Safari < 14 only has the deprecated addListener.
      if (mql.addEventListener) mql.addEventListener("change", onChange);
      else mql.addListener(onChange);
    });

    // Re-read on mount: the first render used the same values, but an SSR or
    // hydration pass may have produced the fallbacks above.
    onChange();

    return () => {
      lists.forEach((mql) => {
        if (mql.removeEventListener) mql.removeEventListener("change", onChange);
        else mql.removeListener(onChange);
      });
    };
  }, []);

  return device;
}

/**
 * Back-compat alias for the original hook. `components/ui/sidebar.jsx` is
 * vendored shadcn and imports `useIsMobile` from `@/hooks/use-mobile` — that
 * file now re-exports this, so there is one implementation, not two.
 */
export function useIsMobile() {
  return useDevice().isMobile;
}
