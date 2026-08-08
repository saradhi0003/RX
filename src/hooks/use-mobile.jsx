/**
 * Back-compat shim. The real implementation now lives in `useDevice.js`, which
 * reports touch, standalone-PWA and orientation as well as width — the shell
 * needs all of those, and two independent matchMedia listeners would be able to
 * disagree with each other.
 *
 * Kept as a file because `components/ui/sidebar.jsx` is vendored shadcn and
 * imports from this path; vendored files are not hand-edited.
 */
export { useIsMobile, MOBILE_BREAKPOINT } from "./useDevice";
