// The LM Studio model router. Two things here are easy to get quietly wrong and
// impossible to notice from the UI:
//   - size parsing, where a version number ("llama-3.2-3b") can be read as the
//     parameter count, silently demoting a model into the wrong tier;
//   - band fallback, where an empty tier must degrade to the nearest model
//     rather than throwing or picking arbitrarily.
// Both are asserted against the real fleet shape (3B/4B/8B/12B/14B/20B).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const FLEET = [
  { id: "gpt-oss-20b-mlx" },
  { id: "qwen2.5-14b-instruct" },
  { id: "gemma-4-12b-it" },
  { id: "llama-3.1-8b-instruct" },
  { id: "qwen2.5-4b-instruct" },
  { id: "llama-3.2-3b-instruct" },
];

function mockModels(models = FLEET) {
  const fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/api/v0/models")) {
      return { ok: true, json: async () => ({ object: "list", data: models }) };
    }
    // OpenAI-compat fallback, used when the native listing is unavailable.
    return { ok: true, json: async () => ({ object: "list", data: models.map(({ id }) => ({ id })) }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Only the native listing answers — exercises the v1 fallback path. */
function mockNativeUnavailable(models = FLEET) {
  const fetchMock = vi.fn(async (url) => {
    if (String(url).includes("/api/v0/models")) return { ok: false, status: 404, statusText: "Not Found" };
    return { ok: true, json: async () => ({ object: "list", data: models.map(({ id }) => ({ id })) }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Fresh module per test — the model cache and env reads are module-scoped. */
async function loadRouter() {
  vi.resetModules();
  return import("@/lib/llmRouter");
}

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("parseParamSize", () => {
  it("reads the parameter count, not the version number", async () => {
    const { parseParamSize } = await loadRouter();
    // The trap: "3.2" appears before "3b" in this id.
    expect(parseParamSize("llama-3.2-3b-instruct")).toBe(3);
    expect(parseParamSize("qwen2.5-14b-instruct")).toBe(14);
    expect(parseParamSize("gpt-oss-20b-mlx")).toBe(20);
    expect(parseParamSize("gemma-4-12b-it")).toBe(12);
  });

  it("returns 0 when the id advertises no size", async () => {
    const { parseParamSize } = await loadRouter();
    expect(parseParamSize("some-mystery-model")).toBe(0);
  });

  it("does not treat a letter-b word as a size", async () => {
    const { parseParamSize } = await loadRouter();
    expect(parseParamSize("bert-base-uncased")).toBe(0);
  });
});

describe("routeFor", () => {
  it("maps free-form call-site labels onto buckets", async () => {
    const { routeFor } = await loadRouter();
    expect(routeFor("bank_statement_parse")).toBe("parsing");
    expect(routeFor("candidate_scoring")).toBe("scoring");
    expect(routeFor("outreach_draft")).toBe("drafting");
    expect(routeFor("email_classification")).toBe("classification");
    expect(routeFor("pipeline_analysis")).toBe("analysis");
  });

  it("passes through exact bucket names and defaults otherwise", async () => {
    const { routeFor } = await loadRouter();
    expect(routeFor("matching")).toBe("matching");
    expect(routeFor("something_unmapped")).toBe("default");
    expect(routeFor(undefined)).toBe("default");
  });
});

describe("resolveModel", () => {
  it("sends heavy structured work to the largest model", async () => {
    mockModels();
    const { resolveModel } = await loadRouter();
    expect(await resolveModel({ task: "resume_parse" })).toBe("gpt-oss-20b-mlx");
  });

  it("keeps chat on a mid-size model rather than the biggest", async () => {
    mockModels();
    const { resolveModel } = await loadRouter();
    const picked = await resolveModel({ task: "chat" });
    expect(picked).toBe("llama-3.1-8b-instruct");
    expect(picked).not.toBe("gpt-oss-20b-mlx");
  });

  it("degrades to the nearest model when a tier band is empty", async () => {
    // Only small models online — heavy work must still resolve, not throw.
    mockModels([{ id: "llama-3.2-3b-instruct" }, { id: "qwen2.5-4b-instruct" }]);
    const { resolveModel } = await loadRouter();
    expect(await resolveModel({ task: "resume_parse" })).toBe("qwen2.5-4b-instruct");
  });

  it("honours a global pin over any routing", async () => {
    mockModels();
    vi.stubEnv("VITE_LMSTUDIO_MODEL", "gemma-4-12b-it");
    const { resolveModel } = await loadRouter();
    expect(await resolveModel({ task: "resume_parse" })).toBe("gemma-4-12b-it");
  });

  it("rejects a pin that matches nothing, listing what is available", async () => {
    mockModels();
    vi.stubEnv("VITE_LMSTUDIO_MODEL", "mistral-large");
    const { resolveModel } = await loadRouter();
    await expect(resolveModel({ task: "chat" })).rejects.toThrow(/gpt-oss-20b-mlx/);
  });

  it("applies a per-task override from the model map", async () => {
    mockModels();
    vi.stubEnv("VITE_LMSTUDIO_MODEL_MAP", '{"parsing":"gemma"}');
    const { resolveModel } = await loadRouter();
    expect(await resolveModel({ task: "resume_parse" })).toBe("gemma-4-12b-it");
    // Other buckets keep their normal ranking.
    expect(await resolveModel({ task: "chat" })).toBe("llama-3.1-8b-instruct");
  });

  it("falls back to ranking when an override matches nothing", async () => {
    mockModels();
    vi.stubEnv("VITE_LMSTUDIO_MODEL_MAP", '{"parsing":"not-installed"}');
    const { resolveModel } = await loadRouter();
    expect(await resolveModel({ task: "resume_parse" })).toBe("gpt-oss-20b-mlx");
  });

  it("explains an unreachable server instead of surfacing 'Failed to fetch'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { resolveModel } = await loadRouter();
    await expect(resolveModel({ task: "chat" })).rejects.toThrow(/Start Server/);
  });

  it("says so when the server is up but has nothing loaded", async () => {
    mockModels([]);
    const { resolveModel } = await loadRouter();
    await expect(resolveModel({ task: "chat" })).rejects.toThrow(/no models/i);
  });
});

describe("listModels caching", () => {
  it("fetches once and shares the result across concurrent callers", async () => {
    const fetchMock = mockModels();
    const { resolveModel } = await loadRouter();
    await Promise.all([
      resolveModel({ task: "chat" }),
      resolveModel({ task: "parsing" }),
      resolveModel({ task: "scoring" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshModels forces a re-read, so a newly linked device is picked up", async () => {
    const fetchMock = mockModels();
    const { resolveModel, refreshModels } = await loadRouter();
    await resolveModel({ task: "chat" });
    await refreshModels();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("native /api/v0 metadata", () => {
  it("never routes generation to an embedding model", async () => {
    // The embedding model is the largest thing installed — pure size ranking
    // would pick it for heavy work and return nonsense.
    mockModels([
      { id: "text-embedding-nomic-30b", type: "embeddings" },
      { id: "qwen2.5-14b-instruct", type: "llm" },
    ]);
    const { resolveModel } = await loadRouter();
    expect(await resolveModel({ task: "resume_parse" })).toBe("qwen2.5-14b-instruct");
  });

  it("prefers an already-loaded model over a cold one in the same band", async () => {
    mockModels([
      { id: "gpt-oss-20b-mlx", type: "llm", state: "not-loaded" },
      { id: "qwen2.5-14b-instruct", type: "llm", state: "loaded" },
    ]);
    const { resolveModel } = await loadRouter();
    // 20B outranks 14B on size, but a cold JIT load costs more than the gap.
    expect(await resolveModel({ task: "resume_parse" })).toBe("qwen2.5-14b-instruct");
  });

  it("skips models whose context cannot hold the prompt", async () => {
    mockModels([
      { id: "qwen2.5-14b-instruct", type: "llm", max_context_length: 4096 },
      { id: "gemma-4-12b-it", type: "llm", max_context_length: 131072 },
    ]);
    const { resolveModel } = await loadRouter();
    // ~40k chars ≈ 10k tokens — only the long-context model fits.
    expect(await resolveModel({ task: "resume_parse", promptChars: 40000 })).toBe("gemma-4-12b-it");
    // Without a size hint the normal ranking applies.
    expect(await resolveModel({ task: "resume_parse" })).toBe("qwen2.5-14b-instruct");
  });

  it("falls back to /v1/models when the native listing is unavailable", async () => {
    const fetchMock = mockNativeUnavailable();
    const { resolveModel } = await loadRouter();
    expect(await resolveModel({ task: "resume_parse" })).toBe("gpt-oss-20b-mlx");
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/v1/models"))).toBe(true);
  });
});
