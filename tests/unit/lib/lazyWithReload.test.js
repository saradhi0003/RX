// Deploy resilience: a tab open across a deploy holds stale content-hashed
// chunk names, so the next lazy route import 404s. lazyWithReload turns that
// into one automatic reload instead of the error boundary.
//
// The dangerous half is the loop guard: a genuinely broken chunk must NOT
// reload forever.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { isChunkLoadError, lazyWithReload } from "@/lib/lazyWithReload";

const reload = vi.fn();

beforeEach(() => {
  reload.mockClear();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  });
});

/** Drive the lazy factory the way React.lazy does, without rendering. */
function invoke(component) {
  return component._payload._result();
}

describe("isChunkLoadError", () => {
  it("recognises how each browser words a failed dynamic import", () => {
    for (const msg of [
      "Importing a module script failed.",                       // Safari / iOS
      "Failed to fetch dynamically imported module: /assets/x.js", // Chrome
      "error loading dynamically imported module",                // Firefox
      "Loading chunk 42 failed",
    ]) {
      expect(isChunkLoadError(new Error(msg))).toBe(true);
    }
  });

  it("does not swallow ordinary application errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe("lazyWithReload", () => {
  it("passes a successful import straight through", async () => {
    const mod = { default: () => null };
    const c = lazyWithReload(() => Promise.resolve(mod));
    await expect(invoke(c)).resolves.toBe(mod);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when a chunk is missing after a deploy", async () => {
    const c = lazyWithReload(() => Promise.reject(new Error("Importing a module script failed.")));
    // Never settles: the reload is already in flight.
    let settled = false;
    invoke(c).then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
  });

  it("does not reload twice — a chunk that is still broken surfaces the error", async () => {
    sessionStorage.setItem("rx.chunk_reload", "1"); // as if we just reloaded
    const err = new Error("Importing a module script failed.");
    const c = lazyWithReload(() => Promise.reject(err));
    await expect(invoke(c)).rejects.toBe(err);
    expect(reload).not.toHaveBeenCalled();
  });

  it("rethrows a non-chunk error without reloading", async () => {
    const err = new TypeError("x is not a function");
    const c = lazyWithReload(() => Promise.reject(err));
    await expect(invoke(c)).rejects.toBe(err);
    expect(reload).not.toHaveBeenCalled();
  });

  it("clears the guard after a success so the next deploy gets its own reload", async () => {
    sessionStorage.setItem("rx.chunk_reload", "1");
    const c = lazyWithReload(() => Promise.resolve({ default: () => null }));
    await invoke(c);
    expect(sessionStorage.getItem("rx.chunk_reload")).toBeNull();
  });
});
