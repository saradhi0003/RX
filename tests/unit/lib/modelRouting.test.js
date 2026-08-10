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

  it("offers the full chain behind a local primary", () => {
    expect(fallbackCandidates("local/google/gemma-4-12b-qat", allKeys)).toEqual([
      "deepseek-chat",
      "qwen-turbo",
      "claude-3-5-haiku-20241022",
    ]);
  });

  it("skips the primary itself", () => {
    expect(fallbackCandidates("deepseek-chat", allKeys)).toEqual([
      "qwen-turbo",
      "claude-3-5-haiku-20241022",
    ]);
  });

  it("skips candidates whose provider has no credentials", () => {
    // Only Anthropic configured — the two OpenAI-compatible candidates drop out.
    expect(
      fallbackCandidates("local/google/gemma-4-12b-qat", {
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
