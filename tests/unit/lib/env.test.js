// Client env module — the browser half of the env pattern (see GAPS.md L20).
// vitest.config.js supplies VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in the
// test env, so "required" vars are present here.
import { describe, it, expect } from "vitest";
import { missingClientEnv, clientEnvPresence, isClientEnvConfigured } from "@/lib/env";

describe("client env module", () => {
  it("reports no missing required vars when supabase env is set", () => {
    expect(missingClientEnv()).toEqual([]);
    expect(isClientEnvConfigured()).toBe(true);
  });

  it("presence map contains booleans for required + optional vars", () => {
    const p = clientEnvPresence();
    expect(p.VITE_SUPABASE_URL).toBe(true);
    expect(p.VITE_SUPABASE_ANON_KEY).toBe(true);
    // optional vars exist as keys with boolean values (unset in test env)
    expect(typeof p.VITE_LIVEKIT_URL).toBe("boolean");
    expect(typeof p.VITE_APP_URL).toBe("boolean");
    // never leak values — map is name → boolean only
    for (const v of Object.values(p)) expect(typeof v).toBe("boolean");
  });
});
