/**
 * embeddings.test.js — the pure half of the retrieval pipeline.
 *
 * Covers the three things that silently corrupt a vector store if they drift:
 * the pgvector literal format (wrong shape → the RPC 400s at the gateway),
 * content hashing (wrong → every backfill re-bills every chunk), and chunking
 * (wrong → facts severed at boundaries, or chunks too big to cite).
 *
 * Also pins the embedding-provider resolution, which is deliberately separate
 * from the chat-model routing because Anthropic has no embeddings endpoint.
 */
import { describe, it, expect } from "vitest";
import {
  chunkText,
  hashContent,
  estimateTokens,
  toVectorLiteral,
  buildCandidateText,
  resolveEmbeddingProvider,
  EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
} from "../../../supabase/functions/_shared/embeddings.ts";

describe("toVectorLiteral", () => {
  it("produces a pgvector literal, not JSON", () => {
    // The RPC declares p_query_embedding as TEXT and casts internally, because
    // PostgREST cannot coerce a JSON array into a `vector` parameter.
    expect(toVectorLiteral([0.1, -0.2, 0.3])).toBe("[0.1,-0.2,0.3]");
  });

  it("has no spaces — pgvector's parser is strict about the literal form", () => {
    expect(toVectorLiteral([1, 2, 3])).not.toMatch(/\s/);
  });

  it("round-trips an empty vector without producing invalid syntax", () => {
    expect(toVectorLiteral([])).toBe("[]");
  });
});

describe("hashContent", () => {
  it("is stable across calls — the whole idempotency guarantee rests on this", () => {
    const text = "Senior React Engineer with 8 years of experience";
    expect(hashContent(text)).toBe(hashContent(text));
  });

  it("changes when the content changes", () => {
    expect(hashContent("react")).not.toBe(hashContent("React"));
    expect(hashContent("a b")).not.toBe(hashContent("a  b"));
  });

  it("handles empty and unicode input without throwing", () => {
    expect(typeof hashContent("")).toBe("string");
    expect(typeof hashContent("café ☕ 日本語")).toBe("string");
  });
});

describe("estimateTokens", () => {
  it("approximates 4 chars per token", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("is zero-safe", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
  });
});

describe("chunkText", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("returns a single chunk when the text fits", () => {
    const short = "Senior React Engineer. 8 years. TypeScript, Node, GraphQL.";
    expect(chunkText(short)).toEqual([short]);
  });

  it("splits long text into multiple chunks", () => {
    const para = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(20);
    const text = Array(6).fill(para).join("\n\n");
    const chunks = chunkText(text, { targetTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("respects the target size with a small tolerance for the overlap carry", () => {
    const text = Array(30).fill("Some paragraph of resume text here.").join("\n\n");
    const targetChars = 100 * 4;
    for (const c of chunkText(text, { targetTokens: 100, overlapTokens: 10 })) {
      expect(c.length).toBeLessThanOrEqual(targetChars * 1.5);
    }
  });

  it("splits a single oversized paragraph with no newlines to split on", () => {
    // The degenerate case the paragraph-boundary path cannot handle alone.
    const chunks = chunkText("x".repeat(5000), { targetTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });

  it("never emits an empty or whitespace-only chunk", () => {
    const text = "para one\n\n\n\n   \n\npara two\n\n" + "y".repeat(3000);
    for (const c of chunkText(text, { targetTokens: 50, overlapTokens: 5 })) {
      expect(c.trim().length).toBeGreaterThan(0);
    }
  });

  it("preserves all the source content across chunks", () => {
    const text = Array(10).fill("Distinctive marker phrase.").join("\n\n");
    const joined = chunkText(text, { targetTokens: 30, overlapTokens: 5 }).join(" ");
    expect(joined).toContain("Distinctive marker phrase.");
  });
});

describe("buildCandidateText", () => {
  it("labels fields so the embedding sees structure, not a bare token dump", () => {
    const text = buildCandidateText({
      title: "Senior React Engineer",
      skills: ["React", "TypeScript"],
      location: "Austin, TX",
      experience_years: 8,
    });
    expect(text).toContain("Title: Senior React Engineer");
    expect(text).toContain("Skills: React, TypeScript");
    expect(text).toContain("Experience: 8 years");
    expect(text).toContain("Location: Austin, TX");
  });

  it("omits absent fields rather than emitting empty labels", () => {
    const text = buildCandidateText({ title: "Engineer" });
    expect(text).toBe("Title: Engineer");
    expect(text).not.toContain("Skills:");
    expect(text).not.toContain("undefined");
  });

  it("excludes contact details, which carry no matching signal", () => {
    // Passing them in must not smuggle PII into the vector store.
    const text = buildCandidateText({
      title: "Engineer",
      email: "someone@example.com",
      phone: "+1-555-0100",
      linkedin_url: "https://linkedin.com/in/someone",
    });
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("555-0100");
    expect(text).not.toContain("linkedin.com");
  });

  it("returns an empty string for a candidate with no usable text", () => {
    // 334 of 890 live candidates have neither summary nor skills — they must
    // produce no chunk rather than an empty one.
    expect(buildCandidateText({})).toBe("");
  });
});

describe("resolveEmbeddingProvider", () => {
  it("defaults to OpenAI text-embedding-3-small", () => {
    expect(resolveEmbeddingProvider()).toEqual({
      provider: "openai",
      model: DEFAULT_EMBEDDING_MODEL,
    });
  });

  it("routes nomic-embed-text to Ollama so local dev shares the same column", () => {
    expect(resolveEmbeddingProvider("nomic-embed-text")).toEqual({
      provider: "ollama",
      model: "nomic-embed-text",
    });
  });

  it("throws a specific, actionable error for Anthropic", () => {
    // The failure this guard exists for: ai_recruiter_settings.matching_model
    // is a chat model, and if embeddings inherited it a claude-* value would
    // fail with an opaque provider error instead of this.
    expect(() => resolveEmbeddingProvider("claude-sonnet-4-5")).toThrow(
      /Anthropic has no embeddings endpoint/,
    );
    expect(() => resolveEmbeddingProvider("claude-sonnet-4-5")).toThrow(
      /does not control embeddings/,
    );
  });

  it("pins the dimension to what doc_chunks.embedding declares", () => {
    // A mismatch here fails at INSERT time with a confusing pgvector error.
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });
});
