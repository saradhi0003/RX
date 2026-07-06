// Vitest global setup — runs before every unit test file.
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll } from "vitest";
import { server } from "./msw/server.js";

// Start the MSW mock network layer for the whole suite.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  cleanup();            // unmount React trees between tests
  server.resetHandlers();
});
afterAll(() => server.close());

// jsdom lacks matchMedia (used by some UI libs) — stub it.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
