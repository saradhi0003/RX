// The lmstudio provider path in src/lib/llm.js.
//
// The load-bearing detail is JSON mode: ~41 of the 46 browser call sites use
// invokeLLMJson, which only forwards `response_format: "json"`. The old Ollama
// path ignored that flag entirely, so a local model was never told to emit
// JSON and every structured feature would have returned prose. These tests pin
// the instruction and the tolerant parse that backs it up.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/aiRecruiterSettings", () => ({
  getModelForTask: vi.fn(async () => "deepseek-chat"),
  getOpenAICompatibleConfig: vi.fn(async () => ({ baseUrl: "", model: "" })),
  refreshAIRecruiterSettings: vi.fn(async () => {}),
}));

const MODELS = { object: "list", data: [{ id: "qwen2.5-14b-instruct" }, { id: "llama-3.1-8b-instruct" }] };

/** Serve /models from the fleet and /chat/completions with `reply`. */
function mockLMStudio(reply) {
  const fetchMock = vi.fn(async (url, init) => {
    if (String(url).endsWith("/models")) {
      return { ok: true, json: async () => MODELS };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: reply } }],
        usage: { prompt_tokens: 11, completion_tokens: 7 },
      }),
      __body: JSON.parse(init.body),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Body of the chat/completions call (the /models call is skipped). */
const chatBody = (fetchMock) =>
  JSON.parse(fetchMock.mock.calls.find(([u]) => String(u).endsWith("/chat/completions"))[1].body);

async function loadLLM({ provider = "lmstudio" } = {}) {
  vi.resetModules();
  vi.stubEnv("VITE_LLM_PROVIDER", provider);
  return import("@/lib/llm");
}

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("lmstudio provider", () => {
  it("posts an OpenAI-shaped body and reads choices[0].message.content", async () => {
    const fetchMock = mockLMStudio("hello from the fleet");
    const { invokeLLM } = await loadLLM();

    const text = await invokeLLM({ prompt: "hi", task: "chat" });

    expect(text).toBe("hello from the fleet");
    const body = chatBody(fetchMock);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.stream).toBe(false);
    expect(body.model).toBe("llama-3.1-8b-instruct"); // chat → balanced tier
  });

  it("routes by task, so a parsing call gets the larger model", async () => {
    const fetchMock = mockLMStudio("{}");
    const { invokeLLMJson } = await loadLLM();
    await invokeLLMJson({ prompt: "extract", task: "resume_parse" });
    expect(chatBody(fetchMock).model).toBe("qwen2.5-14b-instruct");
  });

  it("tells the model to emit JSON when response_format is json", async () => {
    const fetchMock = mockLMStudio('{"ok":true}');
    const { invokeLLMJson } = await loadLLM();

    await invokeLLMJson({ prompt: "extract", system: "You extract data.", task: "resume_parse" });

    const system = chatBody(fetchMock).messages.find((m) => m.role === "system");
    expect(system.content).toContain("You extract data.");
    expect(system.content).toContain("valid JSON only");
  });

  it("adds the JSON instruction even with no system prompt", async () => {
    const fetchMock = mockLMStudio('{"ok":true}');
    const { invokeLLMJson } = await loadLLM();
    await invokeLLMJson({ prompt: "extract", task: "resume_parse" });
    expect(chatBody(fetchMock).messages[0].role).toBe("system");
  });

  it("does not add it for plain text calls", async () => {
    const fetchMock = mockLMStudio("prose");
    const { invokeLLM } = await loadLLM();
    await invokeLLM({ prompt: "write", system: "Be brief.", task: "drafting" });
    const system = chatBody(fetchMock).messages.find((m) => m.role === "system");
    expect(system.content).toBe("Be brief.");
  });

  it("explains an unreachable server rather than surfacing 'Failed to fetch'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { invokeLLM } = await loadLLM();
    await expect(invokeLLM({ prompt: "hi" })).rejects.toThrow(/Start Server/);
  });

  it("surfaces an HTTP error with the model that failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (String(url).endsWith("/models")) return { ok: true, json: async () => MODELS };
      return { ok: false, status: 404, statusText: "Not Found", text: async () => "model not found" };
    }));
    const { invokeLLM } = await loadLLM();
    await expect(invokeLLM({ prompt: "hi", task: "chat" })).rejects.toThrow(/llama-3\.1-8b-instruct/);
  });

  it("leaves the default provider on the proxy", async () => {
    const fetchMock = mockLMStudio("unused");
    const { invokeLLM } = await loadLLM({ provider: "" });
    // callProxy imports the supabase client; failing there is fine — what
    // matters is that LM Studio was never contacted.
    await invokeLLM({ prompt: "hi" }).catch(() => {});
    const hitLMStudio = fetchMock.mock.calls.some(([u]) => String(u).includes("1234"));
    expect(hitLMStudio).toBe(false);
  });
});

describe("invokeLLMJson parsing", () => {
  it("parses a clean object", async () => {
    mockLMStudio('{"name":"Ada","score":9}');
    const { invokeLLMJson } = await loadLLM();
    expect(await invokeLLMJson({ prompt: "x" })).toEqual({ name: "Ada", score: 9 });
  });

  it("strips markdown fences", async () => {
    mockLMStudio('```json\n{"ok":true}\n```');
    const { invokeLLMJson } = await loadLLM();
    expect(await invokeLLMJson({ prompt: "x" })).toEqual({ ok: true });
  });

  it("recovers JSON wrapped in prose — the classic small-model failure", async () => {
    mockLMStudio('Sure! Here is the JSON you asked for:\n{"ok":true}\nHope that helps.');
    const { invokeLLMJson } = await loadLLM();
    expect(await invokeLLMJson({ prompt: "x" })).toEqual({ ok: true });
  });

  it("recovers a top-level array", async () => {
    mockLMStudio('Here you go: [{"id":1},{"id":2}] — done.');
    const { invokeLLMJson } = await loadLLM();
    expect(await invokeLLMJson({ prompt: "x" })).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("quotes the reply when there is no JSON at all", async () => {
    mockLMStudio("I'm sorry, I can't help with that.");
    const { invokeLLMJson } = await loadLLM();
    await expect(invokeLLMJson({ prompt: "x" })).rejects.toThrow(/I'm sorry/);
  });
});

describe("openai-compatible provider", () => {
  const BASE_URL = "https://qwen.example.com/v1";
  const MODEL = "qwen2.5-14b-instruct";

  function mockOpenAICompatible(reply) {
    const fetchMock = vi.fn(async (url, init) => {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: reply } }],
          usage: { prompt_tokens: 12, completion_tokens: 5 },
        }),
        __body: JSON.parse(init.body),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function loadOpenAICompatible() {
    vi.resetModules();
    vi.stubEnv("VITE_LLM_PROVIDER", "openai-compatible");
    vi.stubEnv("VITE_OPENAI_COMPATIBLE_BASE_URL", BASE_URL);
    vi.stubEnv("VITE_OPENAI_COMPATIBLE_MODEL", MODEL);
    return import("@/lib/llm");
  }

  it("posts to the configured base URL and model", async () => {
    const fetchMock = mockOpenAICompatible("hello from qwen");
    const { invokeLLM } = await loadOpenAICompatible();

    const text = await invokeLLM({ prompt: "hi", task: "chat" });

    expect(text).toBe("hello from qwen");
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/chat/completions"));
    expect(call[0]).toBe(`${BASE_URL}/chat/completions`);
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe(MODEL);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.stream).toBe(false);
  });

  it("adds the JSON instruction in invokeLLMJson", async () => {
    const fetchMock = mockOpenAICompatible('{"ok":true}');
    const { invokeLLMJson } = await loadOpenAICompatible();

    await invokeLLMJson({ prompt: "extract", system: "You extract data.", task: "resume_parse" });

    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/chat/completions"));
    const body = JSON.parse(call[1].body);
    const system = body.messages.find((m) => m.role === "system");
    expect(system.content).toContain("You extract data.");
    expect(system.content).toContain("valid JSON only");
  });

  it("errors when VITE_OPENAI_COMPATIBLE_BASE_URL is missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_LLM_PROVIDER", "openai-compatible");
    vi.stubEnv("VITE_OPENAI_COMPATIBLE_BASE_URL", "");
    const { invokeLLM } = await import("@/lib/llm");

    await expect(invokeLLM({ prompt: "hi" })).rejects.toThrow(/VITE_OPENAI_COMPATIBLE_BASE_URL/);
  });

  it("surfaces an HTTP error with the model that failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "model not found",
    })));
    const { invokeLLM } = await loadOpenAICompatible();

    await expect(invokeLLM({ prompt: "hi", task: "chat" })).rejects.toThrow(new RegExp(MODEL));
  });
});
