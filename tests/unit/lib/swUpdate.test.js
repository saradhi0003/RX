// Deploy pickup: registerServiceWorker's update flow.
//
// The old registration was fire-and-forget, on the assumption that a waiting
// worker activates "once every tab is closed". An installed PWA may never close
// its last client, so the old worker kept control and users saw a build they had
// already replaced. These tests pin the behaviours that make the fix safe:
// refresh when a NEW worker replaces an existing one, and never on first
// install (where clients.claim() also fires controllerchange).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const reload = vi.fn();

/** Minimal EventTarget-ish stub with a manual fire(). */
function emitter(extra = {}) {
  const listeners = {};
  return {
    ...extra,
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    removeEventListener: () => {},
    fire: (type) => (listeners[type] || []).forEach((fn) => fn()),
  };
}

/**
 * registerServiceWorker attaches window `load` and document `visibilitychange`
 * listeners and never removes them, so dispatching real events would fan out to
 * every previous test's closure. Capture the listeners and drive only this
 * test's own.
 */
function setup({ hasController, waiting = null } = {}) {
  const registration = emitter({
    waiting,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  const container = emitter({
    controller: hasController ? {} : null,
    register: vi.fn().mockResolvedValue(registration),
  });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });

  const captured = { load: [], visibilitychange: [] };
  vi.spyOn(window, "addEventListener").mockImplementation((type, fn) => {
    if (type === "load") captured.load.push(fn);
  });
  vi.spyOn(document, "addEventListener").mockImplementation((type, fn) => {
    if (type === "visibilitychange") captured.visibilitychange.push(fn);
  });

  return { registration, container, captured };
}

/** Run the load handler and let its awaits settle. */
async function fireLoad(captured) {
  for (const fn of captured.load) await fn();
  await new Promise((r) => setTimeout(r, 0));
}

let registerServiceWorker;

beforeEach(async () => {
  vi.resetModules();
  reload.mockClear();
  vi.stubEnv("PROD", true);
  ({ registerServiceWorker } = await import("@/lib/registerSW"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("registerServiceWorker update flow", () => {
  it("refreshes once when a new worker replaces the one in control", async () => {
    const { container, captured } = setup({ hasController: true });
    registerServiceWorker();
    await fireLoad(captured);

    container.fire("controllerchange");
    expect(reload).toHaveBeenCalledTimes(1);

    // A second event must not start a reload loop.
    container.fire("controllerchange");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on a first install, where claim() also fires the event", async () => {
    const { container, captured } = setup({ hasController: false });
    registerServiceWorker();
    await fireLoad(captured);

    container.fire("controllerchange");
    expect(reload).not.toHaveBeenCalled();
  });

  it("promotes a worker left waiting by a session that never closed its tab", async () => {
    const waiting = { state: "installed", postMessage: vi.fn() };
    const { captured } = setup({ hasController: true, waiting });
    registerServiceWorker();
    await fireLoad(captured);

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("does not promote a waiting worker when nothing is in control yet", async () => {
    const waiting = { state: "installed", postMessage: vi.fn() };
    const { captured } = setup({ hasController: false, waiting });
    registerServiceWorker();
    await fireLoad(captured);

    expect(waiting.postMessage).not.toHaveBeenCalled();
  });

  it("promotes a worker that finishes installing while the page is open", async () => {
    const { registration, captured } = setup({ hasController: true });
    registerServiceWorker();
    await fireLoad(captured);

    const installing = emitter({ state: "installing", postMessage: vi.fn() });
    registration.installing = installing;
    registration.fire("updatefound");

    // Still downloading — nothing to hand over to yet.
    installing.fire("statechange");
    expect(installing.postMessage).not.toHaveBeenCalled();

    installing.state = "installed";
    installing.fire("statechange");
    expect(installing.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("checks for a new build when the app becomes visible again", async () => {
    const { registration, captured } = setup({ hasController: true });
    registerServiceWorker();
    await fireLoad(captured);

    expect(registration.update).toHaveBeenCalledTimes(1); // on load
    captured.visibilitychange.forEach((fn) => fn());
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it("stays inert in development, where a worker would fight Vite HMR", async () => {
    vi.stubEnv("PROD", false);
    vi.resetModules();
    const mod = await import("@/lib/registerSW");
    const { container, captured } = setup({ hasController: true });
    mod.registerServiceWorker();
    await fireLoad(captured);

    expect(container.register).not.toHaveBeenCalled();
    expect(captured.load).toHaveLength(0);
  });
});
