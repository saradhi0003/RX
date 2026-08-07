import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Guards the PWA install contract: manifest, icons, service worker and the
 * <head> wiring that ties them together.
 *
 * These are static-asset checks on purpose — they need no dev server and no
 * Supabase, so they still run when the project is paused. The one thing they
 * can't prove is that Chrome actually offers the install prompt; verify that
 * once by hand via DevTools → Application → Manifest.
 */
const root = path.resolve(__dirname, "../../..");
const publicDir = path.join(root, "public");

const readPublic = (file) => readFileSync(path.join(publicDir, file), "utf8");

const manifest = JSON.parse(readPublic("manifest.webmanifest"));
const indexHtml = readFileSync(path.join(root, "index.html"), "utf8");
const sw = readPublic("sw.js");

/** Width/height straight out of a PNG's IHDR chunk. */
function pngSize(file) {
  const buf = readFileSync(path.join(publicDir, file));
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("web app manifest", () => {
  it("declares the fields Chrome requires to install", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(manifest.display);
  });

  it("ships a 192px and a 512px any-purpose icon", () => {
    const sizes = manifest.icons
      .filter((icon) => icon.purpose !== "maskable")
      .map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("ships a maskable icon so Android doesn't letterbox it", () => {
    const maskable = manifest.icons.filter((icon) =>
      icon.purpose?.split(" ").includes("maskable"),
    );
    expect(maskable.length).toBeGreaterThan(0);
  });

  it("points every icon at a real PNG of the declared size", () => {
    for (const icon of manifest.icons) {
      const file = icon.src.replace(/^\//, "");
      expect(existsSync(path.join(publicDir, file)), `missing ${icon.src}`).toBe(true);

      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(file), `${icon.src} is not ${icon.sizes}`).toEqual({
        width: w,
        height: h,
      });
    }
  });
});

describe("index.html wiring", () => {
  it("links the manifest and the apple-touch-icon", () => {
    expect(indexHtml).toMatch(/<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/);
    expect(indexHtml).toMatch(/<link[^>]+rel="apple-touch-icon"[^>]+href="\/apple-touch-icon\.png"/);
  });

  it("ships a 180px apple-touch-icon", () => {
    expect(pngSize("apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
  });

  it("uses the same theme color as the manifest", () => {
    const meta = indexHtml.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/);
    expect(meta?.[1]?.toUpperCase()).toBe(manifest.theme_color.toUpperCase());
  });
});

describe("service worker", () => {
  it("has a fetch handler — without one Chrome won't offer to install", () => {
    expect(sw).toMatch(/addEventListener\(\s*["']fetch["']/);
  });

  it("precaches only files that exist", () => {
    // Pull the SHELL array out of the source rather than importing it: sw.js is
    // a worker script, not a module, and can't be imported under jsdom.
    const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1];
    expect(shell).toBeTruthy();

    const urls = [...shell.matchAll(/"(\/[^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);

    for (const url of urls) {
      const file = url.replace(/^\//, "");
      expect(existsSync(path.join(publicDir, file)), `precached ${url} is missing`).toBe(true);
    }
  });

  it("has an offline fallback page with no inline script", () => {
    const offline = readPublic("offline.html");
    // CSP is script-src 'self' with no 'unsafe-inline', and the cached response
    // carries those headers — inline JS here would silently never run.
    expect(offline).not.toMatch(/<script(?![^>]*\ssrc=)/i);
    expect(offline).not.toMatch(/\son[a-z]+=/i);
  });

  it("never caches cross-origin responses, which would mean caching PII", () => {
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
    expect(sw).toMatch(/request\.method !== ["']GET["']/);
  });
});
