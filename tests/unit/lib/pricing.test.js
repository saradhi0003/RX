/**
 * pricing.test.js — the cost rail's arithmetic.
 *
 * These matter more than they look: `checkDailyCeiling()` compares a SUM of
 * `cost_usd` against a budget. Before this module existed, nothing server-side
 * wrote a row and the client wrote `cost_usd: 0`, so the sum was always 0 and
 * the ceiling never tripped. Every guarantee about LLM spend rests on
 * estimateCost() returning a truthful number.
 *
 * Imports the Deno-targeted module directly — pricing.ts is deliberately pure
 * (no Deno globals, no imports), which is what makes that possible.
 */
import { describe, it, expect } from "vitest";
import {
  estimateCost,
  priceFor,
  isKnownModel,
  MODEL_PRICES,
  DEFAULT_PRICE,
} from "../../../supabase/functions/_shared/pricing.ts";

describe("priceFor", () => {
  it("resolves an exact model id", () => {
    expect(priceFor("gpt-4o")).toEqual(MODEL_PRICES["gpt-4o"]);
  });

  it("prefers the longest matching prefix", () => {
    // "gpt-4o-mini" also startsWith "gpt-4o" — the cheaper, more specific entry
    // must win, or every mini call is billed at 16x on the dashboard.
    expect(priceFor("gpt-4o-mini")).toEqual(MODEL_PRICES["gpt-4o-mini"]);
    expect(priceFor("gpt-4o-mini").input_per_mtok).toBeLessThan(
      MODEL_PRICES["gpt-4o"].input_per_mtok,
    );
  });

  it("resolves dated snapshot ids via prefix match", () => {
    expect(priceFor("claude-sonnet-4-5-20250929")).toEqual(MODEL_PRICES["claude-sonnet-4-5"]);
  });

  it("is case-insensitive", () => {
    expect(priceFor("GPT-4O-MINI")).toEqual(MODEL_PRICES["gpt-4o-mini"]);
  });

  it("falls back for unknown, null and empty models", () => {
    expect(priceFor("some-model-nobody-has-heard-of")).toEqual(DEFAULT_PRICE);
    expect(priceFor(null)).toEqual(DEFAULT_PRICE);
    expect(priceFor(undefined)).toEqual(DEFAULT_PRICE);
    expect(priceFor("")).toEqual(DEFAULT_PRICE);
  });

  it("never falls back to zero — a $0 default would silently disable the ceiling", () => {
    expect(DEFAULT_PRICE.input_per_mtok).toBeGreaterThan(0);
    expect(DEFAULT_PRICE.output_per_mtok).toBeGreaterThan(0);
  });
});

describe("estimateCost", () => {
  it("computes per-million-token cost for both directions", () => {
    // gpt-4o: $2.50/Mtok in, $10/Mtok out
    // 1,000,000 in + 1,000,000 out = 2.50 + 10.00
    expect(estimateCost("gpt-4o", 1_000_000, 1_000_000)).toBe(12.5);
  });

  it("scales linearly at realistic sweep sizes", () => {
    // The Phase 2 target: ~17k prompt tokens per sweep on gpt-4o-mini.
    const cost = estimateCost("gpt-4o-mini", 17_000, 3_000);
    expect(cost).toBeCloseTo((17_000 / 1e6) * 0.15 + (3_000 / 1e6) * 0.6, 9);
  });

  it("charges nothing for local Ollama models", () => {
    expect(estimateCost("llama3.2", 500_000, 500_000)).toBe(0);
  });

  it("charges only input for embedding models", () => {
    // 3.5M tokens of backfill at $0.02/Mtok = $0.07 — the Phase 1 estimate.
    expect(estimateCost("text-embedding-3-small", 3_500_000, 0)).toBeCloseTo(0.07, 6);
  });

  it("treats zero, negative and non-finite token counts as zero", () => {
    expect(estimateCost("gpt-4o", 0, 0)).toBe(0);
    // A provider returning a negative count must not subtract from the running
    // total — that would un-trip an already-exceeded ceiling.
    expect(estimateCost("gpt-4o", -100, -100)).toBe(0);
    expect(estimateCost("gpt-4o", NaN, Infinity)).toBe(0);
  });

  it("rounds to 6dp to match llm_usage.cost_usd NUMERIC(10,6)", () => {
    const cost = estimateCost("gpt-4o-mini", 1, 1);
    expect(cost).toBe(Number(cost.toFixed(6)));
  });

  it("prices an unknown model at the fallback rather than free", () => {
    expect(estimateCost("mystery-model-9", 1_000_000, 0)).toBe(DEFAULT_PRICE.input_per_mtok);
  });
});

describe("isKnownModel", () => {
  it("distinguishes table hits from fallbacks", () => {
    expect(isKnownModel("gpt-4o-mini")).toBe(true);
    expect(isKnownModel("claude-opus-5-20260101")).toBe(true);
    expect(isKnownModel("mystery-model-9")).toBe(false);
    expect(isKnownModel(null)).toBe(false);
  });

  it("does NOT validate model ids — prefix matching cannot, by design", () => {
    // "claude-opus-4-8" is not a real model id (it was a stale fallback in
    // aiRecruiterMatchCandidates and would 400 at the provider), but it
    // prefix-matches the real "claude-opus-4" entry, so pricing reports it as
    // known and prices it sensibly. That is correct: prefix matching is what
    // lets dated snapshots like claude-opus-4-20250101 resolve without a table
    // entry per release, and the same mechanism cannot tell a typo from a
    // snapshot. Validating model ids is the job of the agent model allow-list,
    // not the price table — do not "fix" this by tightening the match.
    expect(isKnownModel("claude-opus-4-8")).toBe(true);
    expect(priceFor("claude-opus-4-8")).toEqual(MODEL_PRICES["claude-opus-4"]);
  });
});
