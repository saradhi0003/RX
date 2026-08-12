import { describe, it, expect } from "vitest";
import {
  detectProvider,
  isLocalModel,
  stripLocalPrefix,
  fallbackCandidates,
  providerConfigured,
  FALLBACK_MODELS,
} from "../../../supabase/functions/_shared/modelRouting.ts";

describe("modelRouting — local fleet prefix", () => {
  it("routes local/ and lmstudio/ ids to the OpenAI-compatible path", () => {
    expect(detectProvider("local/llama3.2-3b")).toBe("openai-compatible");
    expect(detectProvider("lmstudio/gpt-oss-20b")).toBe("openai-compatible");
  });

  it("strips the prefix down to the id the fleet actually knows", () => {
    expect(stripLocalPrefix("local/qwen/qwen2.5-coder-14b")).toBe("qwen/qwen2.5-coder-14b");
    expect(stripLocalPrefix("lmstudio/llama3.2-3b")).toBe("llama3.2-3b");
    expect(stripLocalPrefix("deepseek-chat")).toBe("deepseek-chat");
  });

  /**
   * The regression that motivated the prefix. Every one of these ids is a real
   * model on the local LM Studio fleet, and every one is claimed by a
   * family-name heuristic that points at somebody else's cloud. Without the
   * prefix, running them "locally" silently ships prompt content — candidate
   * PII here — to Alibaba or Meta-shaped defaults, and bills for it.
   */
  it("prefix beats the family-name heuristics that would pick a cloud", () => {
    // qwen* → DashScope (Alibaba) without the prefix
    expect(detectProvider("qwen/qwen2.5-coder-14b")).toBe("openai-compatible");
    expect(detectProvider("local/qwen/qwen2.5-coder-14b")).toBe("openai-compatible");
    expect(stripLocalPrefix("local/qwen/qwen2.5-coder-14b")).not.toMatch(/^local\//);

    // llama* → the Ollama path without the prefix
    expect(detectProvider("llama3.2-3b")).toBe("ollama");
    expect(detectProvider("local/llama3.2-3b")).toBe("openai-compatible");

    // an unknown id falls through to OpenAI without the prefix
    expect(detectProvider("google/gemma-4-12b-qat")).toBe("openai");
    expect(detectProvider("local/google/gemma-4-12b-qat")).toBe("openai-compatible");
  });

  it("leaves cloud routing untouched", () => {
    expect(detectProvider("claude-opus-4-8")).toBe("anthropic");
    expect(detectProvider("gpt-4o-mini")).toBe("openai");
    expect(detectProvider("deepseek-chat")).toBe("openai-compatible");
    expect(detectProvider("qwen-max")).toBe("openai-compatible");
  });

  it("is case-insensitive and safe on empty input", () => {
    expect(isLocalModel("LOCAL/Foo")).toBe(true);
    expect(isLocalModel("")).toBe(false);
    expect(isLocalModel(undefined)).toBe(false);
    expect(detectProvider(undefined)).toBe("openai");
    expect(stripLocalPrefix(undefined)).toBe("");
  });

  it("does not treat a bare 'local' or a mid-string match as a prefix", () => {
    // No slash — a real model could plausibly be named this.
    expect(isLocalModel("local-model-v2")).toBe(false);
    // The prefix is anchored, so this is a cloud id that merely mentions it.
    expect(isLocalModel("openai/local/thing")).toBe(false);
  });
});

describe("modelRouting — fallback chain", () => {
  const allKeys = { deepseek: true, dashscope: true, anthropic: true };

  it("is cost-ordered: DeepSeek → Qwen → Anthropic", () => {
    expect(FALLBACK_MODELS).toEqual([
      "deepseek-chat",
      "qwen-turbo",
      "claude-3-5-haiku-20241022",
    ]);
  });

  // This previously asserted the opposite — that a local primary offers the
  // full paid chain. That behavior was the bug: a dead tunnel silently served
  // `local/…` requests from DeepSeek and started billing, with the only trace
  // being the model name in llm_usage. A local request must never bill unless
  // someone explicitly opts in.
  it("offers NO paid chain behind a local primary (a local request must not bill)", () => {
    expect(fallbackCandidates("local/google/gemma-4-12b-qat", allKeys)).toEqual([]);
  });

  it("offers the full chain behind a local primary only when paid fallback is opted into", () => {
    expect(
      fallbackCandidates("local/google/gemma-4-12b-qat", allKeys, { allowPaidFallback: true }),
    ).toEqual(["deepseek-chat", "qwen-turbo", "claude-3-5-haiku-20241022"]);
  });

  it("skips the primary itself", () => {
    expect(fallbackCandidates("deepseek-chat", allKeys)).toEqual([
      "qwen-turbo",
      "claude-3-5-haiku-20241022",
    ]);
  });

  it("skips candidates whose provider has no credentials", () => {
    // Only Anthropic configured — the two OpenAI-compatible candidates drop
    // out. Uses a CLOUD primary: a local primary now short-circuits to [] on
    // the spend policy before credentials are even considered.
    expect(
      fallbackCandidates("gpt-4o-mini", {
        deepseek: false,
        dashscope: false,
        anthropic: true,
      }),
    ).toEqual(["claude-3-5-haiku-20241022"]);
  });

  it("returns an empty chain when no fallback provider is configured", () => {
    expect(
      fallbackCandidates("local/google/gemma-4-12b-qat", {
        deepseek: false,
        dashscope: false,
        anthropic: false,
      }),
    ).toEqual([]);
  });

  it("matches providerConfigured to the key each family needs", () => {
    expect(providerConfigured("deepseek-chat", { deepseek: false })).toBe(false);
    expect(providerConfigured("qwen-turbo", { dashscope: false })).toBe(false);
    expect(providerConfigured("claude-3-5-haiku-20241022", { anthropic: false })).toBe(false);
    // Unchecked families are assumed configured — their call path reports the precise error.
    expect(providerConfigured("gpt-4o-mini", {})).toBe(true);
    expect(providerConfigured("local/google/gemma-4-12b-qat", {})).toBe(true);
  });
});

describe("fallbackCandidates — spend policy", () => {
  const allKeys = { deepseek: true, dashscope: true, anthropic: true };

  it("a local primary never falls back to a paid provider by default", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    // The whole point of asking for local/ is that it costs nothing. Quietly
    // answering with DeepSeek/Qwen/Claude is the one outcome that request rules out.
    expect(fallbackCandidates("local/google/gemma-4-12b-qat", allKeys)).toEqual([]);
    expect(fallbackCandidates("lmstudio/llama3.2-3b", allKeys)).toEqual([]);
  });

  it("allows paid fallback for a local primary only when explicitly opted in", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    const out = fallbackCandidates("local/whatever", allKeys, { allowPaidFallback: true });
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("deepseek-chat");
  });

  it("still protects a cloud primary — that call was always going to cost something", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    const out = fallbackCandidates("gpt-4o-mini", allKeys);
    expect(out).toEqual(["deepseek-chat", "qwen-turbo", "claude-3-5-haiku-20241022"]);
  });

  it("skips providers with no credentials rather than burning the timeout", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    const out = fallbackCandidates("gpt-4o-mini", { deepseek: false, dashscope: false, anthropic: true });
    expect(out).toEqual(["claude-3-5-haiku-20241022"]);
  });
});

describe("fallbackCandidates — UI-configured chain", () => {
  const allKeys = { deepseek: true, dashscope: true, anthropic: true };

  it("uses the configured chain verbatim, in order, over the built-in one", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    const chain = ["local/llama3.1-8b", "local/qwen/qwen2.5-coder-14b"];
    expect(fallbackCandidates("local/gemma", allKeys, { chain })).toEqual(chain);
  });

  it("honours an all-local chain without any paid opt-in (stays free)", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    const out = fallbackCandidates("local/gemma", allKeys, { chain: ["local/a", "local/b"] });
    expect(out.every((m) => m.startsWith("local/"))).toBe(true);
  });

  it("drops paid entries from the chain for a local primary unless opted in", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    const chain = ["local/llama3.1-8b", "deepseek-chat", "claude-3-5-haiku-20241022"];
    // The checkbox is off: a request asked to run free must not become billed.
    expect(fallbackCandidates("local/gemma", allKeys, { chain })).toEqual(["local/llama3.1-8b"]);
    // Opted in: the operator's full order is honoured.
    expect(fallbackCandidates("local/gemma", allKeys, { chain, allowPaidFallback: true })).toEqual(chain);
  });

  it("an explicitly empty chain means no fallback at all", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    expect(fallbackCandidates("gpt-4o-mini", allKeys, { chain: [] })).toEqual([]);
  });

  it("still skips the primary and unconfigured providers inside a chain", async () => {
    const { fallbackCandidates } = await import("../../../supabase/functions/_shared/modelRouting.ts");
    const chain = ["deepseek-chat", "qwen-turbo", "claude-3-5-haiku-20241022"];
    const out = fallbackCandidates("deepseek-chat", { deepseek: true, dashscope: false, anthropic: true }, { chain });
    expect(out).toEqual(["claude-3-5-haiku-20241022"]);
  });
});
