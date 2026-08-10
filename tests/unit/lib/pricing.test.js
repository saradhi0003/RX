import { describe, it, expect } from "vitest";
import { estimateCost, getPrice } from "../../../supabase/functions/_shared/pricing.ts";

describe("pricing", () => {
  it("returns zero cost for local/ollama models", () => {
    expect(estimateCost("llama3.2", 1000, 500)).toBe(0);
    expect(estimateCost("lmstudio", 1000, 500)).toBe(0);
  });

  it("estimates DeepSeek chat cost from token counts", () => {
    // deepseek-chat: $0.27 / 1M input, $1.10 / 1M output
    const cost = estimateCost("deepseek-chat", 2_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.54 + 1.1, 6);
  });

  it("estimates Alibaba Qwen cost from token counts", () => {
    // qwen-max: $0.50 / 1M input, $1.50 / 1M output
    const cost = estimateCost("qwen-max", 1_000_000, 500_000);
    expect(cost).toBeCloseTo(0.5 + 0.75, 6);
  });

  it("uses longest-prefix matching for snapshot model ids", () => {
    expect(getPrice("gpt-4o-2024-08-06").input).toBe(2.5);
    expect(getPrice("qwen2.5-14b-instruct").provider).toBe("dashscope");
  });

  it("estimates Anthropic cheapest haiku cost", () => {
    const cost = estimateCost("claude-3-5-haiku-20241022", 1_000_000, 500_000);
    expect(cost).toBeCloseTo(0.8 + 2.0, 6);
  });

  it("returns zero cost for openai-compatible endpoint", () => {
    expect(estimateCost("openai-compatible", 1_000_000, 1_000_000)).toBe(0);
  });

  /**
   * Local inference is free, but the ids are indistinguishable from paid ones
   * (`qwen2.5-coder-14b` is a DashScope product name *and* a file on the
   * laptop). Anything reached through the tunnel is logged under its `local/`
   * id precisely so this table can zero it — otherwise it lands on
   * DEFAULT_PRICE and free calls quietly eat the daily ceiling that gates the
   * paid providers.
   */
  it("prices the local LM Studio fleet at zero regardless of family name", () => {
    expect(estimateCost("local/qwen/qwen2.5-coder-14b", 1_000_000, 1_000_000)).toBe(0);
    expect(estimateCost("local/llama3.2-3b", 1_000_000, 1_000_000)).toBe(0);
    expect(estimateCost("lmstudio/gpt-oss-20b", 1_000_000, 1_000_000)).toBe(0);
    expect(getPrice("local/anything-at-all").provider).toBe("lmstudio-tunnel");
  });

  it("still charges the cloud model whose name the local one borrows", () => {
    // Same family, no prefix: this one really is billable.
    expect(estimateCost("qwen-max", 1_000_000, 0)).toBeCloseTo(0.5, 6);
  });

  it("falls back to a non-zero default for unknown models", () => {
    const price = getPrice("some-unknown-model");
    expect(price.input).toBeGreaterThan(0);
    expect(price.output).toBeGreaterThan(0);
  });
});
